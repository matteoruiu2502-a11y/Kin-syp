"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { Eraser, Mic, Play, Square, Wand2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { parseQuote } from "@/lib/parseQuote";
import { asset, cn, formatMoney } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

// Web Speech API (Chrome / Edge / Safari) — typée au minimum.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const SEPARATOR = /(?:[,;]|\s(?:et|puis|plus|en|dan|und|dann|sowie)\s)(?!.*(?:[,;]|\s(?:et|puis|plus|en|dan|und|dann|sowie)\s))/i;

/** Sépare la partie « validée » de la phrase (jusqu'au dernier séparateur) du fragment en cours. */
function splitCommitted(text: string, done: boolean) {
  if (done) return { committed: text, pending: "" };
  const m = text.match(SEPARATOR);
  if (!m || m.index === undefined) {
    const clientOnly = text.match(/^(?:pour|voor|für)\s+[^,;:]+[,;:]/i);
    return clientOnly ? { committed: clientOnly[0], pending: text.slice(clientOnly[0].length) } : { committed: "", pending: text };
  }
  return { committed: text.slice(0, m.index), pending: text.slice(m.index + m[0].length) };
}

export function LiveQuoteDemo() {
  const { t, lang, locale } = useI18n();
  const d = t.demo;
  const [input, setInput] = useState(d.examples[0]);
  const [transcript, setTranscript] = useState("");
  const [mode, setMode] = useState<"idle" | "typing" | "mic" | "done">("idle");
  const [micError, setMicError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const quoteNo = 147;
  // Date calculée côté client uniquement (évite un écart d'hydratation avec l'export statique)
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  // Changement de langue : repartir de l'exemple de la langue choisie
  useEffect(() => {
    stopAll();
    setInput(d.examples[0]);
    setTranscript("");
    setMode("idle");
  }, [lang]);

  useEffect(() => () => stopAll(), []);

  // Première apparition à l'écran : la démo se lance toute seule
  const section = useRef<HTMLElement>(null);
  const inView = useInView(section, { once: true, margin: "-35% 0px" });
  useEffect(() => {
    if (inView && mode === "idle" && !transcript) simulate();
  }, [inView]);

  function stopAll() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recognition.current?.stop();
    recognition.current = null;
  }

  const simulate = (text = input) => {
    stopAll();
    const words = text.trim().split(/\s+/);
    let i = 0;
    setTranscript("");
    setMode("typing");
    timer.current = setInterval(() => {
      i++;
      setTranscript(words.slice(0, i).join(" "));
      if (i >= words.length) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setMode("done");
      }
    }, 120);
  };

  const startMic = () => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return setMicError(true);
    stopAll();
    const rec = new Ctor();
    rec.lang = locale;
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const r = e.results[k];
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      const full = (finalText + interim).trim();
      setTranscript(full);
      setInput(full);
    };
    rec.onend = () => setMode((m) => (m === "mic" ? "done" : m));
    rec.onerror = () => {
      setMicError(true);
      setMode("idle");
    };
    recognition.current = rec;
    setTranscript("");
    setMicError(false);
    setMode("mic");
    rec.start();
  };

  const reset = () => {
    stopAll();
    setTranscript("");
    setMode("idle");
  };

  const running = mode === "typing" || mode === "mic";
  const { committed, pending } = splitCommitted(transcript, mode === "done");
  const parsed = parseQuote(committed, d.pdf.labour);
  const subtotal = parsed.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const vat = (subtotal * d.pdf.vatRate) / 100;

  return (
    <section ref={section} id="demo" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={d.eyebrow} title={d.title} subtitle={d.subtitle} />

        <Reveal>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pilotage */}
            <div className="card glow-border flex flex-col gap-5 p-5 sm:p-7">
              <div className="flex flex-col gap-2">
                {d.examples.map((ex, i) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setInput(ex);
                      simulate(ex);
                    }}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                      input === ex ? "border-cyan/50 bg-blue/10 text-slate-100" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200",
                    )}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-cyan">{i + 1}</span>
                    <span className="line-clamp-2">{ex}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={d.placeholder}
                rows={3}
                disabled={running}
                className="w-full resize-none rounded-xl border border-white/10 bg-ink/70 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan disabled:opacity-60"
              />

              <div className="flex flex-wrap gap-2">
                <button onClick={() => simulate()} disabled={running || !input.trim()} className="btn-primary text-sm disabled:opacity-50">
                  <Play className="h-4 w-4" /> {d.simulate}
                </button>
                {mode === "mic" ? (
                  <button onClick={() => { recognition.current?.stop(); setMode("done"); }} className="btn-ghost border-red-500/40 text-sm text-red-300">
                    <Square className="h-4 w-4 fill-current" /> {d.stop}
                  </button>
                ) : (
                  <button onClick={startMic} disabled={running} className="btn-ghost text-sm disabled:opacity-50">
                    <Mic className="h-4 w-4 text-emerald" /> {d.mic}
                  </button>
                )}
                <button onClick={reset} className="btn-ghost text-sm" aria-label={d.reset}>
                  <Eraser className="h-4 w-4" /> <span className="hidden sm:inline">{d.reset}</span>
                </button>
              </div>
              {micError && <p className="text-xs text-amber-300">{d.micUnsupported}</p>}

              <div className="mt-auto rounded-2xl border border-white/10 bg-ink/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{d.live}</span>
                  {running && (
                    <span className="flex items-center gap-2 text-xs text-cyan">
                      <span className="flex h-3 items-end gap-[2px]">
                        {[0, 1, 2, 3].map((b) => (
                          <motion.span key={b} className="w-[3px] rounded-full bg-blue" animate={{ height: [3, 12, 5, 10, 3] }} transition={{ duration: 0.8, repeat: Infinity, delay: b * 0.12 }} />
                        ))}
                      </span>
                      {mode === "mic" ? d.listening : <Wand2 className="h-3.5 w-3.5" />}
                    </span>
                  )}
                </div>
                <p className="min-h-[4.5rem] text-sm leading-relaxed text-slate-300">
                  {transcript || <span className="text-slate-600">…</span>}
                  {running && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-cyan" />}
                </p>
              </div>
            </div>

            {/* PDF en temps réel */}
            <div className="relative">
              <div className="flex h-full min-h-[520px] flex-col theme-fixed rounded-2xl bg-white p-6 text-slate-800 shadow-2xl sm:p-8">
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-2">
                    <img src={asset("/brand/biltov-mark.svg")} alt="" className="h-9 w-8 object-contain" />
                    <div>
                      <p className="font-display text-sm font-bold">Dupont Rénovation</p>
                      <p className="text-[10px] text-slate-500">BCE 0403.170.701 · TVA BE 0403.170.701</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-extrabold tracking-tight text-blue">{d.pdf.quote}</p>
                    <p className="text-[11px] text-slate-500">
                      {d.pdf.number}
                      {quoteNo}
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-2 gap-4 py-4 text-xs">
                  <div>
                    <p className="text-slate-400">{d.pdf.client}</p>
                    <AnimatePresence mode="wait">
                      <motion.p key={parsed.client ?? "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("font-semibold", !parsed.client && "text-slate-400")}>
                        {parsed.client ?? d.pdf.clientUnknown}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400">{d.pdf.date}</p>
                    <p className="font-semibold">{today ? today.toLocaleDateString(locale) : "—"}</p>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="rounded-l-lg px-2 py-2 font-semibold">{d.pdf.designation}</th>
                      <th className="px-2 py-2 text-right font-semibold">{d.pdf.qty}</th>
                      <th className="px-2 py-2 text-right font-semibold">{d.pdf.unitPrice}</th>
                      <th className="rounded-r-lg px-2 py-2 text-right font-semibold">{d.pdf.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {parsed.lines.map((l, i) => (
                        <motion.tr
                          key={`${i}-${l.label}`}
                          initial={{ opacity: 0, backgroundColor: "rgba(29,78,216,0.15)" }}
                          animate={{ opacity: 1, backgroundColor: "rgba(29,78,216,0)" }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8 }}
                          className="border-b border-slate-100"
                        >
                          <td className="px-2 py-2.5 font-medium">{l.label}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">
                            {l.qty.toLocaleString(locale)} {l.unit}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{formatMoney(l.price, locale)}</td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{formatMoney(l.qty * l.price, locale)}</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {running && pending.trim() && (
                      <tr>
                        <td colSpan={4} className="px-2 py-2.5">
                          <span className="block h-3 w-3/4 animate-pulse rounded bg-blue/20" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {parsed.lines.length === 0 && !running && <p className="py-10 text-center text-xs text-slate-400">{d.pdf.empty}</p>}

                <div className="mt-auto flex flex-col items-end gap-1 pt-6 text-xs tabular-nums">
                  <p className="text-slate-500">
                    {d.pdf.subtotal} <span className="ml-3 inline-block min-w-24 text-right">{formatMoney(subtotal, locale)}</span>
                  </p>
                  <p className="text-slate-500">
                    {d.pdf.vat} <span className="ml-3 inline-block min-w-24 text-right">{formatMoney(vat, locale)}</span>
                  </p>
                  <p className="mt-1 rounded-lg bg-blue px-3 py-2 font-display text-base font-bold text-white">
                    {d.pdf.totalTTC} <span className="ml-3 inline-block min-w-24 text-right">{formatMoney(subtotal + vat, locale)}</span>
                  </p>
                  <p className="mt-4 self-start text-[10px] text-slate-400">{d.pdf.validity} ______________</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
