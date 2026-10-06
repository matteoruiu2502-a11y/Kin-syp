"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Clock, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";
import { PRICE_MONTHLY } from "@/lib/checkout";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const PRICE = PRICE_MONTHLY;
const MINUTES_WITH_BILTOV = 3;
const RECOVERY_SHARE = 0.3;

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, format);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{text}</motion.span>;
}

function Slider({ label, value, min, max, step, onChange, suffix, locale }: { locale: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="mb-3 flex items-baseline justify-between gap-4 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-display text-lg font-bold tabular-nums text-white">
          {value.toLocaleString(locale)}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range" style={{ ["--fill" as string]: `${fill}%` }} />
    </label>
  );
}

export function RoiCalculator() {
  const { t, locale } = useI18n();
  const r = t.roi;
  const [docs, setDocs] = useState(30);
  const [minutes, setMinutes] = useState(25);
  const [rate, setRate] = useState(50);
  const [unpaid, setUnpaid] = useState(4000);

  const hours = (docs * Math.max(0, minutes - MINUTES_WITH_BILTOV)) / 60;
  const timeValue = hours * rate;
  const recovered = unpaid * RECOVERY_SHARE;
  const roi = timeValue / PRICE;

  const money = (n: number) => formatMoney(n, locale, 0);

  const results = [
    { icon: Clock, label: r.hoursSaved, value: hours, format: (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 1 })} h` },
    { icon: PiggyBank, label: r.moneySaved, value: timeValue, format: money, suffix: r.perMonth },
    { icon: Wallet, label: r.recovered, value: recovered, format: money, suffix: r.perMonth },
  ];

  return (
    <section id="roi" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={r.eyebrow} title={r.title} subtitle={r.subtitle} />

        <Reveal>
          <div className="card glow-border grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-14">
            <div className="space-y-8">
              <Slider label={r.quotes} value={docs} min={5} max={150} step={5} onChange={setDocs} locale={locale} />
              <Slider label={r.minutes} value={minutes} min={5} max={60} step={1} locale={locale} onChange={setMinutes} suffix=" min" />
              <Slider label={r.rate} value={rate} min={25} max={120} step={5} locale={locale} onChange={setRate} suffix=" €" />
              <Slider label={r.unpaid} value={unpaid} min={0} max={30000} step={500} locale={locale} onChange={setUnpaid} suffix=" €" />
              <p className="text-xs leading-relaxed text-slate-500">{r.note}</p>
            </div>

            <div className="flex flex-col gap-4">
              {results.map(({ icon: Icon, label, value, format, suffix }) => (
                <div key={label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink/50 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue/15">
                    <Icon className="h-5 w-5 text-cyan" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="font-display text-3xl font-bold tabular-nums text-white">
                      <AnimatedNumber value={value} format={format} />
                      {suffix && <span className="ml-1 text-sm font-medium text-slate-500">{suffix}</span>}
                    </p>
                  </div>
                </div>
              ))}

              <div className="relative overflow-hidden rounded-2xl bg-blue p-6 text-white">
                <p className="relative flex items-center gap-2 text-sm font-semibold text-white/80">
                  <TrendingUp className="h-4 w-4" /> {r.roi}
                </p>
                <p className="relative font-display text-5xl font-extrabold tabular-nums sm:text-6xl">
                  <AnimatedNumber value={roi} format={(n) => `× ${n.toLocaleString(locale, { maximumFractionDigits: 1 })}`} />
                </p>
                <a href="#tarif" className="relative mt-4 inline-flex items-center gap-2 theme-fixed rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-transform hover:translate-x-1">
                  {r.cta} <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
