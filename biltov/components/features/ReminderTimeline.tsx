"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { BadgeEuro, CheckCircle2, Mail, MessageCircle, Scale } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STEP_ICONS = [MessageCircle, Mail, Scale];

export function ReminderTimeline() {
  const { t } = useI18n();
  const r = t.features.reminders;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-60px" });
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paid, setPaid] = useState(false);

  // Défilement automatique tant que le visiteur n'a pas cliqué
  useEffect(() => {
    if (!inView || !auto || paid) return;
    const id = setInterval(() => setStep((s) => (s + 1) % r.steps.length), 2800);
    return () => clearInterval(id);
  }, [inView, auto, paid, r.steps.length]);

  const current = r.steps[step];

  return (
    <div ref={ref} className="flex h-full flex-col">
      <ol className="relative flex items-start justify-between px-1">
        <span className="absolute left-6 right-6 top-5 h-[2px] bg-white/10" aria-hidden />
        <motion.span
          className={cn("absolute left-6 top-5 h-[2px]", paid ? "bg-emerald" : "bg-gradient-to-r from-blue to-emerald")}
          animate={{ width: paid ? "calc(100% - 3rem)" : `calc(${(step / (r.steps.length - 1)) * 100}% - ${(step / (r.steps.length - 1)) * 3}rem)` }}
          transition={{ duration: 0.5 }}
          aria-hidden
        />
        {r.steps.map((s, i) => {
          const Icon = STEP_ICONS[i];
          const active = i === step && !paid;
          const done = paid || i < step;
          return (
            <li key={s.day} className="relative z-10 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setAuto(false);
                  setPaid(false);
                  setStep(i);
                }}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition-all",
                  paid ? "border-emerald/50 bg-emerald/20 text-emerald" : active ? "border-cyan bg-blue text-white shadow-[0_0_24px_rgba(0,102,255,0.8)]" : done ? "border-blue/50 bg-blue/20 text-sky-300" : "border-white/10 bg-ink text-slate-500",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
              <span className={cn("text-xs font-bold", active ? "text-white" : "text-slate-500")}>{s.day}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 min-h-[9.5rem] flex-1">
        <AnimatePresence mode="wait">
          {paid ? (
            <motion.div key="paid" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-emerald/30 bg-emerald/10 p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald" />
              <p className="text-sm font-semibold text-emerald">{r.paid}</p>
            </motion.div>
          ) : (
            <motion.div key={step + current.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-cyan">{current.title}</p>
              <p className="text-sm leading-relaxed text-slate-300">{current.msg}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => {
          setPaid((p) => !p);
          setAuto(false);
        }}
        className="btn-ghost mt-4 w-full text-sm"
      >
        <BadgeEuro className="h-4 w-4 text-emerald" /> {paid ? t.features.channels.reset : r.markPaid}
      </button>
    </div>
  );
}
