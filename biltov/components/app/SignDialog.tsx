"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { computeTotals } from "@/lib/app/money";
import type { Doc } from "@/lib/app/types";
import { Field, Modal, Notice, inputClass } from "./ui";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const { t } = useTr();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    let drawing = false;
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      c.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(...pos(e));
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      ctx.lineTo(...pos(e));
      ctx.stroke();
    };
    const up = () => {
      if (drawing) onChange(c.toDataURL("image/png"));
      drawing = false;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
    };
  }, [onChange]);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Signature")}</span>
        <button
          type="button"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            onChange(null);
          }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <Eraser className="h-3.5 w-3.5" /> {t("Effacer")}
        </button>
      </div>
      <canvas ref={canvas} className="h-44 w-full theme-fixed touch-none rounded-xl bg-white" />
    </div>
  );
}

/** Signature du devis sur l'appareil (tablette / téléphone), au domicile ou au bureau. */
export function SignDialog({ doc, clientName, onClose, onSigned }: { doc: Doc; clientName: string; onClose: () => void; onSigned: (sig: NonNullable<Doc["signature"]>) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const [name, setName] = useState(clientName);
  const [agree, setAgree] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const ok = image && agree && name.trim();
  return (
    <Modal
      title={t("Signature du devis {n}", { n: doc.number ?? "" })}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!ok} onClick={() => onSigned({ image: image!, name: name.trim(), at: new Date().toISOString() })} className="btn-primary text-sm disabled:opacity-40">
            {t("Valider la signature")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Notice>
          {t("Montant")} : <strong>{f.money(computeTotals(doc).tvac)} TVAC</strong>. {t("Tendez l'appareil au client pour qu'il signe.")}
        </Notice>
        <Field label={t("Nom du signataire")}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <SignaturePad onChange={setImage} />
        <label className="flex items-start gap-2.5 text-sm text-slate-300">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
          {t("« Lu et approuvé, bon pour accord. »")}
        </label>
      </div>
    </Modal>
  );
}
