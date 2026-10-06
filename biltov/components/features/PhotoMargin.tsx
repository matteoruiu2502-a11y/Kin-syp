"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoveHorizontal, ScanLine, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";

const BILLED = 480;

/** Mur « avant » : enduit fissuré, taches. */
const BEFORE_BG = [
  "radial-gradient(circle at 30% 40%, rgba(120,90,60,0.55) 0 8%, transparent 9%)",
  "radial-gradient(circle at 70% 70%, rgba(90,70,50,0.5) 0 12%, transparent 13%)",
  "linear-gradient(115deg, transparent 48%, rgba(20,20,20,0.9) 49%, transparent 50%)",
  "linear-gradient(70deg, transparent 62%, rgba(20,20,20,0.7) 62.5%, transparent 63.5%)",
  "linear-gradient(180deg, #6b6459, #4d473f)",
].join(",");

/** Mur « après » : faïence 30×60 neuve. */
const AFTER_BG = [
  "linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
  "linear-gradient(0deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
  "linear-gradient(135deg, #f1f5f9, #cbd5e1)",
].join(",");

export function PhotoMargin() {
  const { t, locale } = useI18n();
  const p = t.features.photo;
  const [split, setSplit] = useState(50);
  const [scan, setScan] = useState<"idle" | "scanning" | "done">("idle");
  const costs = p.items.reduce((s, i) => s + i.value, 0);
  const margin = BILLED - costs;

  const startScan = () => {
    setScan("scanning");
    setTimeout(() => setScan("done"), 1800);
  };

  return (
    <div className="grid h-full gap-4 md:grid-cols-2">
      {/* Avant / Après */}
      <div className="relative min-h-[240px] overflow-hidden rounded-2xl border border-white/10 select-none">
        <div className="absolute inset-0" style={{ background: AFTER_BG, backgroundSize: "40px 20px, 40px 20px, cover" }} />
        <div className="absolute inset-0" style={{ background: BEFORE_BG, clipPath: `inset(0 ${100 - split}% 0 0)` }} />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{p.before}</span>
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">{p.after}</span>
        <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-slate-300">📍 14/03 08:12 → 21/03 17:40</span>
        <div className="pointer-events-none absolute inset-y-0 theme-fixed w-0.5 bg-white shadow-[0_0_12px_white]" style={{ left: `${split}%` }}>
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg">
            <MoveHorizontal className="h-4 w-4" />
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          aria-label={`${p.before} / ${p.after}`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      {/* Scan de ticket + marge */}
      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden theme-fixed rounded-2xl bg-[#f8f5ee] p-4 font-mono text-[11px] text-slate-700">
          <p className="mb-2 text-center font-bold tracking-widest">{p.receipt.toUpperCase()}</p>
          {p.items.map((item, i) => (
            <div key={item.label} className="flex justify-between border-b border-dashed border-slate-300 py-1">
              <span>{item.label}</span>
              <motion.span
                animate={scan === "done" ? { backgroundColor: ["rgba(29,78,216,0)", "rgba(29,78,216,0.25)", "rgba(29,78,216,0.1)"] } : {}}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="rounded px-1"
              >
                {formatMoney(item.value, locale)}
              </motion.span>
            </div>
          ))}
          {scan === "scanning" && (
            <span className="absolute inset-x-0 h-0.5 animate-scan bg-blue" />
          )}
        </div>

        <AnimatePresence mode="wait">
          {scan === "done" ? (
            <motion.div key="res" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-2 text-center">
              <Stat label={p.billed} value={formatMoney(BILLED, locale, 0)} />
              <Stat label={p.costs} value={`-${formatMoney(costs, locale, 0)}`} />
              <Stat label={p.margin} value={formatMoney(margin, locale, 0)} highlight sub={`${Math.round((margin / BILLED) * 100)} %`} />
            </motion.div>
          ) : (
            <motion.button key="btn" onClick={startScan} disabled={scan === "scanning"} className="btn-primary w-full text-sm disabled:opacity-70">
              <ScanLine className="h-4 w-4" /> {scan === "scanning" ? p.scanning : p.scan}
            </motion.button>
          )}
        </AnimatePresence>
        {scan === "done" && (
          <button onClick={() => setScan("idle")} className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">
            ↺ {p.scan}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <div className={highlight ? "rounded-xl border border-emerald/40 bg-emerald/10 p-2" : "rounded-xl border border-white/10 bg-white/[0.03] p-2"}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={highlight ? "font-display text-lg font-bold text-emerald" : "font-display text-lg font-bold text-white"}>{value}</p>
      {sub && (
        <p className="flex items-center justify-center gap-1 text-[10px] text-emerald">
          <TrendingUp className="h-3 w-3" /> {sub}
        </p>
      )}
    </div>
  );
}
