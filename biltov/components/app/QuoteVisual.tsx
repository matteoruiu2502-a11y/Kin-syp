"use client";

// Devis : « Avant / après » pour le client. Une photo de la situation actuelle et une visualisation du résultat
// attendu (simulation, croquis, photo d'une réalisation semblable). Les deux images sont ajoutées au PDF du devis.

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Images, MoveHorizontal, Trash2 } from "lucide-react";
import { compressImage, useAppData } from "@/lib/app/store";
import { uid } from "@/lib/app/defaults";
import { useTr } from "@/lib/app/tr";
import type { Doc, Job, QuoteVisual } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { inputClass } from "./ui";
import { useBlobUrl } from "./PhotosPanel";

const EMPTY: QuoteVisual = { before: null, after: null, caption: "" };

export function QuoteVisualPanel({ doc, job, locked, onChange }: { doc: Doc; job: Job; locked: boolean; onChange: (v: QuoteVisual | null) => void }) {
  const { t } = useTr();
  const { data, putBlob } = useAppData();
  const v = doc.visual ?? EMPTY;
  const set = (patch: Partial<QuoteVisual>) => {
    const next = { ...v, ...patch };
    onChange(next.before || next.after || next.caption.trim() ? next : null);
  };

  // photos « avant » de ce chantier ; réalisations « après » des autres chantiers (exemples de résultat)
  const befores = useMemo(() => data.photos.filter((p) => p.jobId === job.id && p.phase === "avant"), [data.photos, job.id]);
  const references = useMemo(() => data.photos.filter((p) => p.phase === "apres" && p.jobId !== job.id).slice(-12).reverse(), [data.photos, job.id]);

  const upload = async (slot: "before" | "after", file: File | undefined) => {
    if (!file) return;
    const key = `visual:${uid()}`;
    await putBlob(key, (await compressImage(file, 2000, 0.85)).blob);
    set({ [slot]: key });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Images className="h-4 w-4 text-cyan" /> {t("Avant / après pour le client")}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t("Montrez la situation actuelle et le résultat attendu. Les deux images sont ajoutées au PDF du devis, avec la mention « visualisation non contractuelle ».")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slot
          label={t("Avant : situation actuelle")}
          value={v.before}
          locked={locked}
          onUpload={(f) => upload("before", f)}
          onClear={() => set({ before: null })}
          choices={befores.map((p) => `photo:${p.id}`)}
          choicesLabel={t("Photos « avant » du chantier")}
          onPick={(key) => set({ before: key })}
        />
        <Slot
          label={t("Après : visualisation du résultat")}
          hint={t("Simulation, croquis ou photo d'une réalisation semblable.")}
          value={v.after}
          locked={locked}
          onUpload={(f) => upload("after", f)}
          onClear={() => set({ after: null })}
          choices={references.map((p) => `photo:${p.id}`)}
          choicesLabel={t("Vos réalisations (photos « après » d'autres chantiers)")}
          onPick={(key) => set({ after: key })}
        />
      </div>

      {v.before && v.after && <Compare before={v.before} after={v.after} />}

      <input className={inputClass} placeholder={t("Légende pour le client (facultatif)")} value={v.caption} disabled={locked} onChange={(e) => set({ caption: e.target.value })} />
    </section>
  );
}

function Slot({ label, hint, value, locked, onUpload, onClear, choices, choicesLabel, onPick }: { label: string; hint?: string; value: string | null; locked: boolean; onUpload: (f: File | undefined) => void; onClear: () => void; choices: string[]; choicesLabel: string; onPick: (key: string) => void }) {
  const { t } = useTr();
  const url = useBlobUrl(value);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <button type="button" disabled={locked || busy} onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-500 hover:text-white disabled:hover:text-slate-500">
            <ImagePlus className="h-6 w-6" />
            {busy ? t("Chargement…") : t("Prendre ou importer une photo")}
            {hint && <span className="text-[11px] text-slate-600">{hint}</span>}
          </button>
        )}
        {url && !locked && (
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-black/70 p-1.5 text-white" aria-label={t("Remplacer l'image")} title={t("Remplacer l'image")}>
              <ImagePlus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClear} className="rounded-lg bg-black/70 p-1.5 text-white hover:text-rose-300" aria-label={t("Retirer l'image")} title={t("Retirer l'image")}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          setBusy(true);
          try {
            await onUpload(f);
          } finally {
            setBusy(false);
          }
        }}
      />
      {!locked && choices.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-slate-500">{choicesLabel}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {choices.map((key) => (
              <Choice key={key} blobKey={key} active={key === value} onPick={() => onPick(key)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Choice({ blobKey, active, onPick }: { blobKey: string; active: boolean; onPick: () => void }) {
  const { t } = useTr();
  const url = useBlobUrl(blobKey);
  return (
    <button type="button" onClick={onPick} aria-pressed={active} aria-label={t("Choisir cette photo")} className={cn("h-12 w-16 shrink-0 overflow-hidden rounded-lg border bg-white/5", active ? "border-cyan ring-1 ring-cyan" : "border-white/10")}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

/** Aperçu à glisser, tel que le client comprendra le projet. */
function Compare({ before, after }: { before: string; after: string }) {
  const { t } = useTr();
  const a = useBlobUrl(before);
  const b = useBlobUrl(after);
  const [split, setSplit] = useState(50);
  if (!a || !b) return null;
  return (
    <div className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-black">
      <img src={b} alt={t("Après")} className="absolute inset-0 h-full w-full object-cover" />
      <img src={a} alt={t("Avant")} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">{t("Avant")}</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">{t("Après")}</span>
      <div className="pointer-events-none absolute inset-y-0 theme-fixed w-0.5 bg-white" style={{ left: `${split}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900">
          <MoveHorizontal className="h-4 w-4" />
        </span>
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" aria-label={t("Comparer avant / après")} />
    </div>
  );
}
