"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, LifeBuoy, MessageCircleQuestion, RotateCcw, Square, X } from "lucide-react";
import { AI_ERROR_TEXT, AiError, HELP_SUGGESTIONS, aiOnline, askHelp, type AiErrorCode, type ChatMessage } from "@/lib/ai";
import { HELP_EVENT, SUPPORT_EMAIL } from "@/lib/help";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";

const STORE = "biltov.help";
const MIN_INTERVAL_MS = 1500;
const MAX_PER_HOUR = 30;

type Stored = { messages: ChatMessage[]; sent: number[] };

function load(): Stored {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Stored | null;
    if (s && Array.isArray(s.messages)) return { messages: s.messages, sent: s.sent ?? [] };
  } catch {}
  return { messages: [], sent: [] };
}

/** Chat d'aide : bouton flottant sur toutes les pages, réponses tirées de la base de connaissances. */
export function HelpChat() {
  const path = usePathname();
  const inApp = path?.includes("tableau-de-bord");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiErrorCode | "throttled" | null>(null);
  const sent = useRef<number[]>([]);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const s = load();
    setMessages(s.messages);
    sent.current = s.sent;
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ messages, sent: sent.current }));
    } catch {}
  }, [messages]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, error]);

  // Ouverture depuis n'importe quel bouton « Aide » du site
  useEffect(() => {
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      setOpen(true);
      if (q) setInput(q);
      setTimeout(() => field.current?.focus(), 250);
    };
    window.addEventListener(HELP_EVENT, onOpen);
    return () => window.removeEventListener(HELP_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const run = useCallback(async (history: ChatMessage[]) => {
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    let started = false;
    try {
      await askHelp(
        history,
        (delta) => {
          setMessages((m) => {
            if (!started) {
              started = true;
              return [...m, { role: "assistant", content: delta }];
            }
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + delta };
            return copy;
          });
        },
        ctrl.signal,
      );
    } catch (e) {
      // réponse partielle retirée : l'utilisateur relance proprement
      if (started) setMessages((m) => m.slice(0, -1));
      setError(e instanceof AiError ? e.code : "server");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, []);

  const send = (text: string) => {
    const content = text.trim().slice(0, 2000);
    if (!content || busy) return;
    const now = Date.now();
    sent.current = sent.current.filter((t) => now - t < 3600_000);
    if (sent.current.length >= MAX_PER_HOUR || (sent.current.length && now - sent.current[sent.current.length - 1] < MIN_INTERVAL_MS)) return setError("throttled");
    sent.current.push(now);
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setInput("");
    void run(history);
  };

  const retry = () => {
    const last = messages[messages.length - 1];
    if (last?.role === "user") void run(messages);
  };

  const reset = () => {
    abort.current?.abort();
    setMessages([]);
    setError(null);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => (setOpen(true), setTimeout(() => field.current?.focus(), 250))}
            className={cn(
              "fixed right-4 z-[55] flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-emerald px-4 font-semibold sm:pr-5 text-white shadow-[0_12px_40px_-8px_rgba(0,102,255,0.7)] transition-transform hover:scale-105 theme-fixed sm:right-6",
              inApp ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6" : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6",
            )}
            aria-label="Ouvrir l'aide Biltov"
          >
            <MessageCircleQuestion className="h-6 w-6" />
            <span className={cn("text-sm", inApp && "hidden sm:inline")}>Aide</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Aide Biltov"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-0 z-[80] flex h-[100dvh] flex-col bg-ink sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[400px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
          >
            <header className="flex items-center gap-3 border-b border-white/10 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald text-white theme-fixed">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-white">Aide Biltov</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={cn("h-1.5 w-1.5 rounded-full", aiOnline() ? "bg-emerald" : "bg-amber-400")} />
                  {aiOnline() ? "Assistant en ligne" : "Réponses de la base d'aide"}
                </span>
              </span>
              {messages.length > 0 && (
                <button type="button" onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Nouvelle conversation" title="Nouvelle conversation">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Fermer l'aide">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={list} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
              <Bubble role="assistant">Bonjour ! Je réponds à vos questions sur l&apos;utilisation de Biltov : devis, factures, dictée vocale, équipe, compte… Que voulez-vous faire ?</Bubble>
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {HELP_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="min-h-11 rounded-2xl border border-white/10 px-3.5 py-2 text-left text-sm text-slate-300 hover:border-cyan/50 hover:text-white">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role}>
                  {m.role === "assistant" ? <Markdown text={m.content} onNavigate={() => setOpen(false)} /> : m.content}
                </Bubble>
              ))}
              {busy && messages[messages.length - 1]?.role === "user" && <TypingDots />}
              {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
                  {error === "throttled" ? "Doucement ! Attendez un instant avant d'envoyer un autre message." : AI_ERROR_TEXT[error]}
                  {error !== "throttled" && (
                    <button type="button" onClick={retry} className="ml-2 font-semibold text-white underline">
                      Réessayer
                    </button>
                  )}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-white/10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 focus-within:border-cyan">
                <textarea
                  ref={field}
                  rows={1}
                  value={input}
                  maxLength={2000}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Votre question…"
                  aria-label="Votre question"
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-base text-slate-100 outline-none placeholder:text-slate-500"
                />
                {busy ? (
                  <button type="button" onClick={() => abort.current?.abort()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white" aria-label="Arrêter la réponse">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue to-emerald text-white disabled:opacity-40 theme-fixed" aria-label="Envoyer">
                    <ArrowUp className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-center text-[11px] text-slate-500">
                L&apos;assistant répond à partir de l&apos;aide Biltov et peut se tromper.{" "}
                {SUPPORT_EMAIL && (
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan underline">
                    Contacter le support
                  </a>
                )}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed", role === "user" ? "rounded-br-md bg-gradient-to-br from-blue to-blue/80 text-white theme-fixed" : "rounded-bl-md border border-white/10 bg-white/[0.04] text-slate-200")}>{children}</div>
    </div>
  );
}

export function TypingDots({ label = "L'assistant écrit…" }: { label?: string }) {
  return (
    <div className="flex justify-start" aria-label={label}>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-2 w-2 rounded-full bg-slate-400" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </div>
  );
}
