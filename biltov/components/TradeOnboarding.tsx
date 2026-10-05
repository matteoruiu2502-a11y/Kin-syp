"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrickWall, Hammer, Trees, Mic, PaintRoller, Package, Percent, Sparkles, Wrench, Zap, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TradeId } from "@/lib/content/fr";
import { cn, formatMoney } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const ICONS: Record<TradeId, LucideIcon> = {
  plombier: Wrench,
  electricien: Zap,
  peintre: PaintRoller,
  macon: BrickWall,
  menuisier: Hammer,
  paysagiste: Trees,
};

const QUOTES = { fr: ["« ", " »"], nl: ["“", "”"], de: ["„", "“"] } as const;

export function TradeOnboarding() {
  const { t, lang, locale } = useI18n();
  const [open, close] = QUOTES[lang];
  const [active, setActive] = useState<TradeId>("plombier");
  const trade = t.trades.list.find((x) => x.id === active)!;
  const L = t.trades.labels;
  const total = trade.lines.reduce((sum, l) => sum + l.qty * l.price, 0);

  return (
    <section id="metiers" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={t.trades.eyebrow} title={t.trades.title} subtitle={t.trades.subtitle} />

        <Reveal>
          <div role="tablist" aria-label={t.trades.eyebrow} className="mx-auto mb-8 flex max-w-3xl snap-x gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] p-1.5 sm:justify-center">
            {t.trades.list.map((tr) => {
              const Icon = ICONS[tr.id];
              const selected = tr.id === active;
              return (
                <button
                  key={tr.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(tr.id)}
                  className={cn(
                    "relative flex shrink-0 snap-start items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                    selected ? "text-white" : "text-slate-400 hover:text-white",
                  )}
                >
                  {selected && (
                    <motion.span layoutId="trade-pill" className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-br from-blue/40 to-emerald/30 shadow-[0_0_30px_-5px_rgba(0,102,255,0.6)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{tr.name}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="card glow-ring overflow-hidden">
            {/* Barre de fenêtre façon app */}
            <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-amber-400/70" />
              <span className="h-3 w-3 rounded-full bg-emerald/70" />
              <span className="ml-3 text-xs text-slate-500">app.biltov.eu / {trade.name.toLowerCase()}</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active + t.trades.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_1.35fr]"
              >
                <div className="space-y-6">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan">
                      <Mic className="h-3.5 w-3.5" /> {L.dictation}
                    </p>
                    <blockquote className="rounded-2xl border border-white/10 bg-ink/60 p-4 text-slate-200 italic leading-relaxed">
                      {open}
                      {trade.voice}
                      {close}
                    </blockquote>
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <Sparkles className="h-3.5 w-3.5 text-emerald" /> {L.jargon}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {trade.jargon.map((j, i) => (
                        <motion.span
                          key={j}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                          className="rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1 text-xs font-medium text-emerald"
                        >
                          {j}
                        </motion.span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <Package className="h-3.5 w-3.5 text-blue" /> {L.supplies}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {trade.supplies.map((s, i) => (
                        <motion.span
                          key={s}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.04 }}
                          className="truncate rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-slate-300"
                        >
                          {s}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink/50 p-4 sm:p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{L.generated}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                          <th className="pb-2 font-medium">{L.designation}</th>
                          <th className="pb-2 text-right font-medium">{L.qty}</th>
                          <th className="pb-2 text-right font-medium">{L.price}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trade.lines.map((line, i) => (
                          <motion.tr
                            key={line.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.08 }}
                            className="border-b border-white/5"
                          >
                            <td className="py-3 pr-3 text-slate-200">{line.label}</td>
                            <td className="py-3 text-right tabular-nums text-slate-400">
                              {line.qty.toLocaleString(locale)} {line.unit}
                            </td>
                            <td className="py-3 text-right tabular-nums text-slate-300">{formatMoney(line.price, locale)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/30 bg-blue/10 px-3 py-1 text-xs text-sky-300">
                      <Percent className="h-3.5 w-3.5" /> {L.vat} : {trade.vat}
                    </span>
                    <span className="text-sm text-slate-400">
                      {L.total} <strong className="ml-2 font-display text-2xl text-white tabular-nums">{formatMoney(total, locale)}</strong>
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
