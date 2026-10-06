import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cadre « iPhone » réaliste en CSS : contour titane, écran arrondi, Dynamic Island, boutons latéraux.
 * L'écran garde le format d'un iPhone (390 × 844) : aucun décalage de mise en page au chargement.
 */
export function IPhoneFrame({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <figure className={cn("relative mx-auto w-full max-w-[300px] theme-fixed", className)} aria-label={label}>
      {/* boutons latéraux */}
      <span aria-hidden className="absolute -left-[3px] top-[17%] h-[5%] w-[3px] rounded-l-sm bg-gradient-to-b from-slate-500 to-slate-700" />
      <span aria-hidden className="absolute -left-[3px] top-[25%] h-[9%] w-[3px] rounded-l-sm bg-gradient-to-b from-slate-500 to-slate-700" />
      <span aria-hidden className="absolute -left-[3px] top-[36%] h-[9%] w-[3px] rounded-l-sm bg-gradient-to-b from-slate-500 to-slate-700" />
      <span aria-hidden className="absolute -right-[3px] top-[28%] h-[13%] w-[3px] rounded-r-sm bg-gradient-to-b from-slate-500 to-slate-700" />
      <div className="rounded-[3.1rem] bg-gradient-to-br from-slate-500 via-slate-700 to-slate-600 p-[3px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="rounded-[2.95rem] bg-black p-[9px]">
          <div className="relative aspect-[390/844] overflow-hidden rounded-[2.35rem] bg-[#0b1220]">
            {children}
            {/* Dynamic Island */}
            <span aria-hidden className="absolute left-1/2 top-[1.4%] h-[3.6%] w-[31%] -translate-x-1/2 rounded-full bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.04)]" />
            {/* reflet */}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2.35rem] bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
          </div>
        </div>
      </div>
      {label && <figcaption className="mt-4 text-center text-sm text-[var(--muted)]">{label}</figcaption>}
    </figure>
  );
}
