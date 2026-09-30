"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, FileDown, Loader2, MoveHorizontal, Trash2, Upload } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { buildPhotoReport } from "@/lib/app/pdf";
import { downloadBlob } from "@/lib/app/send";
import type { Job, Photo, PhotoPhase } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Empty, inputClass } from "./ui";

const PHASES: { id: PhotoPhase; label: string }[] = [
  { id: "avant", label: "Avant" },
  { id: "pendant", label: "Pendant" },
  { id: "apres", label: "Après" },
];

function useBlobUrl(key: string | null) {
  const { blobUrl } = useAppData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (key) blobUrl(key).then((u) => alive && setUrl(u));
    else setUrl(null);
    return () => {
      alive = false;
    };
  }, [key, blobUrl]);
  return url;
}

function Thumb({ photo, onRemove, onCaption, selected, onSelect }: { photo: Photo; onRemove: () => void; onCaption: (c: string) => void; selected: boolean; onSelect: () => void }) {
  const url = useBlobUrl(`photo:${photo.id}`);
  const { t } = useTr();
  return (
    <figure className={cn("group overflow-hidden rounded-xl border bg-ink/60 transition-colors", selected ? "border-cyan" : "border-white/10")}>
      <button type="button" onClick={onSelect} className="relative block aspect-[4/3] w-full bg-white/5" aria-label={t("Choisir pour la comparaison")}>
        {url && <img src={url} alt={photo.caption || t("Photo du chantier")} className="h-full w-full object-cover" />}
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{new Date(photo.takenAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
      </button>
      <figcaption className="flex items-center gap-1 p-1.5">
        <input className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-300 outline-none placeholder:text-slate-600" placeholder={t("Légende…")} defaultValue={photo.caption} onBlur={(e) => onCaption(e.target.value)} />
        <button onClick={onRemove} className="rounded p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </figcaption>
    </figure>
  );
}

function Compare({ before, after }: { before: Photo; after: Photo }) {
  const { t } = useTr();
  const a = useBlobUrl(`photo:${before.id}`);
  const b = useBlobUrl(`photo:${after.id}`);
  const [split, setSplit] = useState(50);
  if (!a || !b) return null;
  return (
    <div className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl border border-white/10 bg-black">
      <img src={b} alt="Après" className="absolute inset-0 h-full w-full object-cover" />
      <img src={a} alt="Avant" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
      <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">{t("Avant")} · {new Date(before.takenAt).toLocaleDateString()}</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">{t("Après")} · {new Date(after.takenAt).toLocaleDateString()}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_white]" style={{ left: `${split}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900">
          <MoveHorizontal className="h-4 w-4" />
        </span>
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" aria-label={t("Comparer avant / après")} />
    </div>
  );
}

/** Photos du chantier : avant / pendant / après, horodatées, comparaison et rapport PDF. */
export function PhotosPanel({ job }: { job: Job }) {
  const { data, addPhotos, update, getBlob, isDemo } = useAppData();
  const { t } = useTr();
  const updatePhoto = (p: Photo) => update((d) => ({ ...d, photos: d.photos.map((x) => (x.id === p.id ? p : x)) }));
  const removePhoto = (id: string) => update((d) => ({ ...d, photos: d.photos.filter((x) => x.id !== id) }));
  const photos = useMemo(() => data.photos.filter((p) => p.jobId === job.id), [data.photos, job.id]);
  const [phase, setPhase] = useState<PhotoPhase>("avant");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ avant?: string; apres?: string }>({});

  const befores = photos.filter((p) => p.phase === "avant");
  const afters = photos.filter((p) => p.phase === "apres");
  const before = befores.find((p) => p.id === pick.avant) ?? befores[0];
  const after = afters.find((p) => p.id === pick.apres) ?? afters[0];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      await addPhotos(job.id, phase, [...files]);
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    try {
      const pdf = await buildPhotoReport(job, data.clients.find((c) => c.id === job.clientId), photos, data, (id) => getBlob(`photo:${id}`), isDemo ? "DÉMONSTRATION" : undefined);
      downloadBlob(pdf.output("blob"), `rapport-photo-${job.name}.pdf`.replace(/[^\w.-]+/g, "-"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <select className={cn(inputClass, "!w-auto")} value={phase} onChange={(e) => setPhase(e.target.value as PhotoPhase)} aria-label={t("Étape")}>
          {PHASES.map((p) => (
            <option key={p.id} value={p.id}>
              {t("Photos")} « {t(p.label)} »
            </option>
          ))}
        </select>
        <label className="btn-primary cursor-pointer text-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t("Prendre / importer")}
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        </label>
        <label className="btn-ghost cursor-pointer text-sm">
          <Upload className="h-4 w-4" /> {t("Galerie")}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        </label>
        <button onClick={report} disabled={!photos.length || busy} className="btn-ghost text-sm disabled:opacity-40">
          <FileDown className="h-4 w-4" /> {t("Rapport photo PDF")}
        </button>
      </div>

      {before && after && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Comparaison avant / après — cliquez une photo pour la choisir")}</p>
          <Compare before={before} after={after} />
        </div>
      )}

      {photos.length === 0 ? (
        <Empty icon={Camera} text={t("Ajoutez des photos avant, pendant et après les travaux : elles sont horodatées et servent de preuve en cas de litige.")} />
      ) : (
        PHASES.map((p) => {
          const list = photos.filter((x) => x.phase === p.id);
          if (!list.length) return null;
          return (
            <section key={p.id}>
              <h4 className="mb-2 font-display text-sm font-bold text-white">
                {t(p.label)} <span className="text-slate-500">({list.length})</span>
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((photo) => (
                  <Thumb
                    key={photo.id}
                    photo={photo}
                    selected={photo.id === before?.id || photo.id === after?.id}
                    onSelect={() => (p.id === "avant" || p.id === "apres") && setPick((s) => ({ ...s, [p.id]: photo.id }))}
                    onCaption={(caption) => caption !== photo.caption && updatePhoto({ ...photo, caption })}
                    onRemove={() => window.confirm(t("Supprimer cette photo ?")) && removePhoto(photo.id)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
