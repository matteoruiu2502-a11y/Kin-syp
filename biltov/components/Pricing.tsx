"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PRICE_MONTHLY, PRICE_YEARLY, trialHref } from "@/lib/checkout";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const MONTHLY = PRICE_MONTHLY;
const YEARLY_MONTHLY = PRICE_YEARLY / 12; // 79 € / mois

export function Pricing() {
  const { t } = useI18n();
  const p = t.pricing;
  const [yearly, setYearly] = useState(false);
  const price = yearly ? YEARLY_MONTHLY : MONTHLY;

  return (
    <section id="tarif" className="relative py-24 sm:py-32">
      <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />

        <Reveal className="mb-10 flex justify-center">
          <div role="group" className="relative flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
            {[
              { id: false, label: p.monthly },
              { id: true, label: p.yearly },
            ].map((o) => (
              <button
                key={String(o.id)}
                onClick={() => setYearly(o.id)}
                aria-pressed={yearly === o.id}
                className={cn("relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors", yearly === o.id ? "text-white" : "text-slate-400 hover:text-white")}
              >
                {yearly === o.id && <motion.span layoutId="billing-pill" className="absolute inset-0 rounded-full bg-blue" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative">{o.label}</span>
                {o.id && <span className="relative rounded-full bg-emerald/20 px-2 py-0.5 text-[10px] font-bold text-emerald ring-1 ring-emerald/40">{p.save}</span>}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute -inset-px rounded-[2rem] bg-blue opacity-80" aria-hidden />
            <div className="relative grid gap-10 rounded-[2rem] bg-night p-8 sm:p-12 md:grid-cols-[1fr_1.1fr]">
              <div className="flex flex-col">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue/15 px-3 py-1.5 text-xs font-bold text-cyan ring-1 ring-blue/40">
                  <InfinityIcon className="h-3.5 w-3.5" /> {p.badge}
                </span>
                <h3 className="mt-6 font-display text-2xl font-bold text-white">{p.plan}</h3>
                <div className="mt-4 flex items-end gap-2">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={price}
                      initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
                      transition={{ duration: 0.35 }}
                      className="text-gradient font-display text-7xl font-extrabold leading-none tracking-tighter sm:text-8xl"
                    >
                      {price}
                    </motion.span>
                  </AnimatePresence>
                  <span className="pb-2 text-sm text-slate-400">{p.perMonth}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {yearly ? p.billedYearly : p.billedMonthly}
                  {yearly && <s className="ml-2 text-slate-600">960 €</s>}
                </p>
                <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">💡 {p.roiLine}</p>

                <a href={trialHref()} className="btn-primary group mt-8 text-base">
                  {p.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> {p.guarantee}
                </p>
              </div>

              <ul className="space-y-3.5 md:border-l md:border-white/10 md:pl-10">
                {p.features.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-start gap-3 text-sm text-slate-300"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                    {f}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
