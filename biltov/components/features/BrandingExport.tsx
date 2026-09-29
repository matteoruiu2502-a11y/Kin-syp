"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ImageUp, Landmark } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn, formatMoney } from "@/lib/utils";

const COLORS = ["#0066FF", "#10B981", "#F97316", "#E11D48", "#7C3AED", "#0F172A"];

const COUNTRIES = [
  { code: "FR", flag: "🇫🇷", rate: 20 },
  { code: "BE", flag: "🇧🇪", rate: 21 },
  { code: "DE", flag: "🇩🇪", rate: 19 },
  { code: "LU", flag: "🇱🇺", rate: 17 },
  { code: "CH", flag: "🇨🇭", rate: 8.1 },
  { code: "ES", flag: "🇪🇸", rate: 21 },
  { code: "IT", flag: "🇮🇹", rate: 22 },
];

const LINES = [
  { key: "a", qty: 18, unit: "m²", price: 42 },
  { key: "b", qty: 1, unit: "u", price: 390 },
  { key: "c", qty: 16, unit: "h", price: 48 },
];

const formatIban = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 34)
    .replace(/(.{4})/g, "$1 ")
    .trim();

export function BrandingExport() {
  const { t, locale } = useI18n();
  const b = t.features.brand;
  const [color, setColor] = useState(COLORS[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [iban, setIban] = useState("FR76 3000 6000 0112 3456 7890 189");
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo);
  }, [logo]);

  const labels = t.features.voice.pdfLines;
  const subtotal = LINES.reduce((s, l) => s + l.qty * l.price, 0);
  const vat = (subtotal * country.rate) / 100;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      {/* Réglages */}
      <div className="space-y-5">
        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 transition-colors hover:border-cyan/60 hover:bg-white/[0.04]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
            {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <ImageUp className="h-5 w-5 text-cyan" />}
          </span>
          <span className="text-sm font-semibold text-slate-200">{b.upload}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setLogo(URL.createObjectURL(file));
            }}
          />
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{b.color}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={cn("h-9 w-9 rounded-full border-2 transition-transform hover:scale-110", color === c ? "scale-110 border-white" : "border-transparent")}
                style={{ background: c, boxShadow: color === c ? `0 0 20px ${c}` : undefined }}
              />
            ))}
            <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/30" title={b.color}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute -inset-2 h-14 w-14 cursor-pointer opacity-0" aria-label={b.color} />
              <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] opacity-70" />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{b.country}</p>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCountry(c)}
                aria-pressed={country.code === c.code}
                className={cn("rounded-xl border px-3 py-1.5 text-sm transition-colors", country.code === c.code ? "border-cyan bg-blue/20 text-white" : "border-white/10 text-slate-400 hover:text-white")}
              >
                {c.flag} {c.code} <span className="text-xs text-slate-500">{c.rate.toLocaleString(locale)} %</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Landmark className="h-3.5 w-3.5" /> {b.iban}
          </span>
          <input
            value={iban}
            onChange={(e) => setIban(formatIban(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-ink/70 px-4 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-cyan"
            spellCheck={false}
          />
        </label>
      </div>

      {/* Aperçu PDF */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{b.preview}</p>
        <motion.div layout className="overflow-hidden rounded-2xl bg-white text-slate-800 shadow-[0_30px_80px_-30px_rgba(0,102,255,0.6)]">
          <motion.div animate={{ backgroundColor: color }} className="flex items-center justify-between px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/90">
                {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <span className="font-display text-lg font-extrabold" style={{ color }}>D</span>}
              </span>
              <span className="font-display font-bold">{b.company}</span>
            </div>
            <span className="text-xs font-semibold opacity-90">{t.features.voice.quote}</span>
          </motion.div>
          <div className="p-5 text-xs">
            <table className="w-full">
              <tbody>
                {LINES.map((l, i) => (
                  <tr key={l.key} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{labels[i]}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {l.qty} {l.unit}
                    </td>
                    <td className="py-2 pl-2 text-right font-medium tabular-nums">{formatMoney(l.qty * l.price, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-col items-end gap-1 tabular-nums">
              <span className="text-slate-500">
                {b.subtotal} : {formatMoney(subtotal, locale)}
              </span>
              <span className="text-slate-500">
                {b.vat} {country.rate.toLocaleString(locale)} % ({country.code}) : {formatMoney(vat, locale)}
              </span>
              <motion.span animate={{ color }} className="mt-1 font-display text-base font-bold">
                {b.total} : {formatMoney(subtotal + vat, locale)}
              </motion.span>
            </div>
            <div className="mt-4 rounded-lg px-3 py-2 font-mono text-[10px]" style={{ background: `${color}14`, color }}>
              {b.iban} : {iban || "—"}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
