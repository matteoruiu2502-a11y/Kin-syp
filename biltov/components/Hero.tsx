"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { DASHBOARD_PATH } from "@/lib/checkout";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, CreditCard, Mic, MousePointer2, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const HeroScene = dynamic(() => import("./hero/HeroScene"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-full bg-blue/5 blur-3xl" />,
});

const REASSURANCE_ICONS = [BadgeCheck, CreditCard, ShieldCheck];
const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { t } = useI18n();
  const h = t.hero;

  return (
    <section id="top" className="relative isolate min-h-[100svh] overflow-hidden pt-28 lg:pt-32">
      {/* Fond : grille + halos néon */}
      <div className="bg-grid absolute inset-0 -z-10" aria-hidden />
      <div className="absolute -left-40 top-20 -z-10 h-[520px] w-[520px] rounded-full bg-blue/25 blur-[140px]" aria-hidden />
      <div className="absolute -right-20 bottom-0 -z-10 h-[480px] w-[480px] rounded-full bg-emerald/20 blur-[140px]" aria-hidden />

      <div className="mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:min-h-[calc(100svh-8rem)] lg:justify-center">
        <div className="relative z-10 pb-4 lg:max-w-[40rem] lg:pb-20">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="glow-border inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald" />
            {h.badge}
          </motion.span>

          <h1 className="mt-6 font-display text-[2.4rem] font-bold leading-[1.02] tracking-tight text-white sm:text-6xl xl:text-[4.25rem]">
            {[h.titleA, h.titleHighlight, h.titleB].map((line, i) => (
              <motion.span
                key={`${line}-${i}`}
                initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease }}
                className={i === 1 ? "text-gradient block" : i === 2 ? "mt-4 block font-sans text-2xl font-semibold tracking-tight text-slate-300 sm:text-3xl xl:text-4xl" : "block"}
              >
                {line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400"
          >
            {h.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.62, ease }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a href="#demo" className="btn-primary group text-base">
              <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
                <Mic className="relative h-3.5 w-3.5" />
              </span>
              {h.ctaPrimary}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <Link href={DASHBOARD_PATH} className="btn-ghost text-base">
              <UserPlus className="h-4 w-4" /> {h.ctaSecondary}
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400"
          >
            {h.reassurance.map((item, i) => {
              const Icon = REASSURANCE_ICONS[i % REASSURANCE_ICONS.length];
              return (
                <li key={item} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-emerald" />
                  {item}
                </li>
              );
            })}
          </motion.ul>

          <motion.dl
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.95, ease }}
            className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur"
          >
            {h.stats.map((s) => (
              <div key={s.label} className="px-4 py-3">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl font-bold text-white">{s.value}</dd>
                <dd className="text-xs leading-snug text-slate-500">{s.label}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, delay: 0.2, ease }}
          className="relative -mx-4 h-[400px] sm:h-[500px] lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:h-auto lg:w-[58%] [mask-image:linear-gradient(to_bottom,black_75%,transparent)]"
          aria-hidden
        >
          <HeroScene />
          <p className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-xs text-slate-400 backdrop-blur md:flex">
            <MousePointer2 className="h-3.5 w-3.5 text-cyan" />
            {h.canvasHint}
          </p>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" aria-hidden />
    </section>
  );
}
