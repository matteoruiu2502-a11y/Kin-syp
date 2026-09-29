"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import type { Doc, Job } from "@/lib/app/types";
import { computeTotals, eur } from "@/lib/app/money";
import { Field, Modal, Notice, inputClass } from "./ui";

/** Signature du devis sur l'écran (tablette / téléphone), avec la mention « Bon pour accord ». */
export function SignDialog({ doc, job, onClose, onSigned }: { doc: Doc; job: Job; onClose: () => void; onSigned: (sig: NonNullable<Doc["signature"]>) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState(job.client);
  const [agree, setAgree] = useState(false);
  const [vatCert, setVatCert] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const needsVatCert = doc.lines.some((l) => l.vat === 10 || l.vat === 5.5);

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
      setDrawn(true);
    };
    const up = () => (drawing = false);
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
    };
  }, []);

  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  };

  const ok = drawn && agree && name.trim() && (!needsVatCert || vatCert);

  return (
    <Modal
      title={`Signature du devis ${doc.number}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            Annuler
          </button>
          <button disabled={!ok} onClick={() => onSigned({ image: canvas.current!.toDataURL("image/png"), name: name.trim(), at: new Date().toISOString() })} className="btn-primary text-sm disabled:opacity-40">
            Valider la signature
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Notice>
          Montant du devis : <strong>{eur(computeTotals(doc).ttc)} TTC</strong>. Tendez l&apos;appareil au client pour qu&apos;il signe ci-dessous.
        </Notice>
        <Field label="Nom du signataire">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Signature</span>
            <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
              <Eraser className="h-3.5 w-3.5" /> Effacer
            </button>
          </div>
          <canvas ref={canvas} className="h-44 w-full touch-none rounded-xl bg-white" />
        </div>
        <label className="flex items-start gap-2.5 text-sm text-slate-300">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
          « Bon pour accord, devis reçu avant l&apos;exécution des travaux. »
        </label>
        {needsVatCert && (
          <label className="flex items-start gap-2.5 text-sm text-slate-300">
            <input type="checkbox" checked={vatCert} onChange={(e) => setVatCert(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
            Je certifie que les travaux portent sur un local à usage d&apos;habitation achevé depuis plus de deux ans (taux réduit de TVA).
          </label>
        )}
      </div>
    </Modal>
  );
}
