"use client";

import { ImageUp, Palette, Trash2 } from "lucide-react";
import type { Branding } from "@/lib/app/types";
import { useTr } from "@/lib/app/tr";
import { cn } from "@/lib/utils";

const COLORS = ["#0066FF", "#10B981", "#F97316", "#E11D48", "#7C3AED", "#0F172A", "#B45309"];

/** Réduit le logo (PNG, 600 px max) pour des PDF légers. */
async function resizeLogo(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function BrandingForm({ value, onChange }: { value: Branding; onChange: (b: Branding) => void }) {
  const { t } = useTr();
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
        <Palette className="h-4 w-4 text-cyan" /> {t("Personnalisation des PDF")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <label className="flex flex-1 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-3 hover:border-cyan/60">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              {value.logo ? <img src={value.logo} alt="Logo" className="h-full w-full object-contain" /> : <ImageUp className="h-5 w-5 text-slate-400" />}
            </span>
            <span className="text-sm font-semibold text-slate-200">{value.logo ? t("Changer le logo") : t("Importer votre logo")}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={async (e) => e.target.files?.[0] && onChange({ ...value, logo: await resizeLogo(e.target.files[0]) })} />
          </label>
          {value.logo && (
            <button type="button" onClick={() => onChange({ ...value, logo: null })} className="rounded-lg p-2 text-slate-400 hover:text-rose-400" aria-label={t("Retirer le logo")}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Couleur des documents")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...value, color: c })}
                aria-label={c}
                aria-pressed={value.color.toLowerCase() === c.toLowerCase()}
                className={cn("h-8 w-8 rounded-full border-2", value.color.toLowerCase() === c.toLowerCase() ? "border-white" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
            <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} className="h-8 w-10 cursor-pointer rounded bg-transparent" aria-label={t("Couleur personnalisée")} />
          </div>
        </div>
      </div>
    </section>
  );
}
