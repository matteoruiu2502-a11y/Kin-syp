"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUp, FilePenLine, Loader2, Mic, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useFmt } from "@/lib/app/format";
import { applyVat, audit, createQuote } from "@/lib/app/ops";
import { newClient, newJob, uid } from "@/lib/app/defaults";
import { computeTotals } from "@/lib/app/money";
import { normalizeLabel } from "@/lib/app/materials";
import { applyActions, interpretLocally, nextQuestion, type Pending, type VoiceDraft } from "@/lib/app/voiceQuote";
import { MAX_SECONDS, RECORDER_ERROR_TEXT, useVoiceRecorder } from "@/lib/app/useVoiceRecorder";
import { AI_ERROR_TEXT, AiError, interpretWithAi } from "@/lib/ai";
import { cn } from "@/lib/utils";
import { TypingDots } from "../site/HelpChat";

type Msg =
  | { id: string; from: "user"; kind: "text"; text: string }
  | { id: string; from: "user"; kind: "voice"; audioKey: string | null; duration: number; transcript: string }
  | { id: string; from: "bot"; kind: "text"; text: string; chips?: string[]; tone?: "error" }
  | { id: string; from: "bot"; kind: "preview"; quoteId: string };

type Saved = { messages: Msg[]; draft: VoiceDraft; quoteId: string | null; pending: Pending; skipped: string[] };
const EMPTY: Saved = { messages: [], draft: { client: null, lines: [] }, quoteId: null, pending: null, skipped: [] };
const SKIP = "Je ne sais pas encore";
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Événement global pour ouvrir la dictée vocale depuis n'importe quel écran. */
export const VOICE_EVENT = "biltov:voice-quote";
export const openVoiceQuote = () => window.dispatchEvent(new Event(VOICE_EVENT));

/**
 * Dictée vocale en conversation : l'artisan envoie des messages vocaux (ou écrits), Biltov pose les
 * questions manquantes, crée le devis et le met à jour à chaque correction. La conversation est
 * conservée tant que le devis reste en brouillon.
 */
export function VoiceQuoteChat({ onClose, onOpenDoc }: { onClose: () => void; onOpenDoc: (id: string) => void }) {
  const f = useFmt();
  const { data, account, update, run, putBlob, blobUrl } = useAppData();
  const key = `biltov.voice.${account?.id ?? "x"}`;
  const [s, setS] = useState<Saved>(EMPTY);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [netError, setNetError] = useState<string | null>(null);
  const rec = useVoiceRecorder(data.company.lang === "nl" ? "nl-BE" : data.company.lang === "de" ? "de-BE" : "fr-BE");
  const holdStart = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const sRef = useRef(s);
  sRef.current = s;

  // Reprise de la conversation si le devis n'est pas finalisé
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Saved | null;
      const q = saved?.quoteId ? data.docs.find((d) => d.id === saved.quoteId) : null;
      const finalised = saved?.quoteId && (!q || q.status !== "draft" || q.lockedAt);
      if (saved && !finalised) setS(saved);
    } catch {}
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {}
  }, [s, ready, key]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [s.messages.length, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && rec.state === "idle" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, rec.state]);

  const push = (...msgs: Msg[]) => setS((x) => ({ ...x, messages: [...x.messages, ...msgs] }));
  const bot = (t: string, extra: Partial<Extract<Msg, { from: "bot"; kind: "text" }>> = {}): Msg => ({ id: uid(), from: "bot", kind: "text", text: t, ...extra });

  const catalog = { articles: data.articles.filter((a) => a.active), lang: data.company.lang, trade: data.company.trade };

  /** Crée le devis (client et chantier au besoin) ou met à jour ses lignes. */
  /** Client du devis : fiche existante au nom proche, sinon nouvelle fiche. */
  const resolveClient = (name: string) => {
    const wanted = normalizeLabel(name.replace(/^(mme|mlle|m\.)\s+/i, ""));
    const found = data.clients.find((c) => wanted && normalizeLabel(c.name).includes(wanted));
    if (found) return { client: found, existing: true };
    const c = newClient({ name, lang: data.company.lang });
    update((d) => audit({ ...d, clients: [c, ...d.clients] }, "create", "client", c.id, c.name));
    return { client: c, existing: false };
  };

  /** Crée le devis (client et chantier au besoin) ou met à jour ses lignes et son client. Renvoie l'id et un message éventuel. */
  const syncQuote = (draft: VoiceDraft, quoteId: string | null, clientChanged: boolean): { id: string | null; note: string | null } => {
    if (quoteId) {
      const q = data.docs.find((d) => d.id === quoteId);
      if (!q || q.lockedAt || q.status !== "draft") return { id: quoteId, note: null };
      const who = clientChanged && draft.client ? resolveClient(draft.client) : null;
      update((d) => {
        const doc = applyVat(d, { ...q, lines: draft.lines, ...(who ? { clientId: who.client.id } : {}) });
        return { ...d, docs: d.docs.map((x) => (x.id === q.id ? doc : x)), jobs: d.jobs.map((j) => (j.id === q.jobId ? { ...j, amount: computeTotals(doc).htva, ...(who ? { clientId: who.client.id } : {}) } : j)) };
      });
      return { id: quoteId, note: who ? (who.existing ? `Le devis est maintenant au nom du client existant « ${who.client.name} ».` : `Nouveau client créé : « ${who.client.name} ».`) : null };
    }
    const { client, existing } = resolveClient(draft.client ?? "Client à préciser");
    const job = newJob({ clientId: client.id, name: `${draft.lines[0]?.label ?? "Travaux"} — ${client.name}`, trade: data.company.trade, notes: "Créé par dictée vocale" });
    update((d) => audit({ ...d, jobs: [job, ...d.jobs] }, "create", "job", job.id, job.name));
    const id = run((d) => createQuote(d, job.id, draft.lines)).id;
    return { id, note: existing ? `J'ai associé le devis à votre client existant « ${client.name} ». Si ce n'est pas le bon, dites « le client c'est … ».` : null };
  };

  /** Traite un message de l'artisan (vocal transcrit ou écrit). */
  const handle = useCallback(
    async (message: string) => {
      const cur = sRef.current;
      setNetError(null);
      // le devis peut avoir été modifié dans l'éditeur : il fait foi
      const q = cur.quoteId ? data.docs.find((d) => d.id === cur.quoteId) : null;
      const draft: VoiceDraft = q ? { ...cur.draft, lines: q.lines } : cur.draft;
      if (q && (q.lockedAt || q.status !== "draft")) {
        push(bot(`Le devis ${q.number ?? ""} est déjà envoyé ou signé : il ne se modifie plus ici. Ouvrez-le pour créer une nouvelle version, ou commencez un nouveau devis.`));
        return;
      }
      setBusy(true);
      if (!cur.quoteId && !cur.messages.some((m) => m.from === "bot")) push(bot("Merci pour ces informations, nous créons votre devis…"));

      // « Je ne sais pas encore » : la ligne reste « à chiffrer », on passe à la suite
      let skipped = cur.skipped;
      let result: Parameters<typeof applyActions>[1];
      if (cur.pending && /^(?:je ne sais pas|plus tard|passe|aucune idée|on verra)/i.test(message.trim())) {
        skipped = [...skipped, cur.pending.kind === "client" ? "client" : cur.pending.lineId];
        result = { client: draft.client, actions: [] };
      } else {
        let ai = null;
        try {
          // une réponse à une question précise (choix, quantité, prix) est interprétée localement : plus fiable
          ai = navigator.onLine && !cur.pending ? await interpretWithAi({ text: message, draft: { client: draft.client, lines: draft.lines.filter((l) => l.kind === "item").map((l) => ({ id: l.id, label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice })) }, catalog: catalog.articles.slice(0, 300).map((a) => ({ label: a.name.fr, unit: a.unit, price: a.salePrice })), pending: cur.pending ? (nextQuestion(draft, skipped)?.text ?? null) : null }) : null;
        } catch (e) {
          // serveur indisponible : l'analyse locale prend le relais
          if (e instanceof AiError && e.code === "rate_limited") setNetError(AI_ERROR_TEXT.rate_limited);
        }
        const interpreted = ai ?? interpretLocally(message, draft, cur.pending, catalog);
        result = interpreted;
        if (interpreted.reply) {
          await new Promise((r) => setTimeout(r, 450));
          push(bot(interpreted.reply));
        }
      }
      const next = applyActions(draft, result, catalog);
      const question = nextQuestion(next, skipped);
      let quoteId = cur.quoteId;
      const out: Msg[] = [];
      const chips = (q: NonNullable<typeof question>) => q.chips ?? (q.pending.kind === "client" ? undefined : [SKIP]);
      if (question?.pending.kind === "client" && !quoteId) {
        // le nom du client est nécessaire pour créer le devis ; le reste se complète ensuite dans la conversation
        out.push(bot(question.text));
      } else if (next.lines.some((l) => l.kind === "item")) {
        const created = !quoteId;
        const synced = syncQuote(next, quoteId, !!quoteId && next.client !== draft.client);
        quoteId = synced.id;
        if (synced.note) out.push(bot(synced.note));
        if (created && quoteId) out.push(bot(question ? "Votre devis est créé. Il reste à préciser quelques points ; vous pouvez aussi le corriger à la voix (« change le prix de… », « ajoute… », « supprime… »)." : "Votre devis est prêt. Vérifiez-le, corrigez-le à la voix (« change le prix de… », « ajoute… », « supprime… ») ou ouvrez-le pour le modifier, l'exporter en PDF et l'envoyer."), { id: uid(), from: "bot", kind: "preview", quoteId });
        else if (quoteId) out.push({ id: uid(), from: "bot", kind: "preview", quoteId });
        if (question) out.push(bot(question.text, { chips: chips(question) }));
      }
      setS((x) => ({ ...x, draft: next, quoteId, pending: question?.pending ?? null, skipped, messages: [...x.messages, ...out] }));
      setBusy(false);
    },
    [data], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const sendText = (t = text) => {
    const v = t.trim();
    if (!v || busy) return;
    push({ id: uid(), from: "user", kind: "text", text: v });
    setText("");
    void handle(v);
  };

  const finishRecording = async () => {
    const r = await rec.stop();
    if (!r) return;
    if (r.duration < 0.6 || (!r.blob && !r.transcript)) {
      push(bot("Message vocal trop court ou vide. Maintenez le micro un peu plus longtemps, ou écrivez votre message.", { tone: "error" }));
      return;
    }
    let audioKey: string | null = null;
    if (r.blob && r.blob.size > 0) {
      audioKey = `voice:${uid()}`;
      await putBlob(audioKey, r.blob);
    }
    push({ id: uid(), from: "user", kind: "voice", audioKey, duration: r.duration, transcript: r.transcript });
    if (!r.transcript) {
      push(bot(rec.transcriptionSupported ? (navigator.onLine ? "Je n'ai pas pu transcrire ce vocal. Pouvez-vous réessayer en parlant plus près du micro, ou écrire votre message ?" : "Pas de connexion internet : la transcription est impossible pour l'instant. Écrivez votre message, ou réessayez une fois connecté.") : "Ce navigateur ne sait pas transcrire la voix. Écrivez votre message : l'analyse est la même.", { tone: "error" }));
      return;
    }
    void handle(r.transcript);
  };

  const reset = () => {
    rec.cancel();
    setS(EMPTY);
    setNetError(null);
  };

  const recording = rec.state === "recording";
  const currentQuote = s.quoteId ? data.docs.find((d) => d.id === s.quoteId) : undefined;
  const lastPreview = [...s.messages].reverse().find((m) => m.kind === "preview")?.id;

  return (
    <motion.div role="dialog" aria-modal="true" aria-label="Dictée vocale" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="card flex h-[100dvh] w-full flex-col overflow-hidden rounded-none sm:h-[min(820px,calc(100dvh-2rem))] sm:max-w-2xl sm:rounded-3xl">
        <header className="flex items-center gap-2 border-b border-white/10 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-4 sm:pt-3">
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 hover:bg-white/5" aria-label="Fermer la dictée">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald text-white theme-fixed">
            <Mic className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold text-white">Dictée vocale</span>
            <span className="block truncate text-xs text-slate-400">{currentQuote ? `Devis ${currentQuote.number ?? ""} · ${data.clients.find((c) => c.id === currentQuote.clientId)?.name ?? ""}` : "Décrivez les travaux, Biltov écrit le devis"}</span>
          </span>
          {s.messages.length > 0 && (
            <button type="button" onClick={() => window.confirm("Commencer un nouveau devis ? Cette conversation sera effacée (le devis déjà créé est conservé).") && reset()} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-300 hover:bg-white/5">
              <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Nouveau devis</span>
            </button>
          )}
        </header>

        <div ref={list} className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,rgba(0,102,255,0.08),transparent_60%)] px-3 py-4 sm:px-5" aria-live="polite">
          <BotBubble>
            <p>Bonjour ! Appuyez sur le micro et dictez votre devis.</p>
            <p className="mt-2 font-semibold">Pour un devis juste :</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Commencez par le client : « Pour Mme Peeters ».</li>
              <li>Puis chaque poste : quantité + unité + matériau (+ prix si vous le connaissez).</li>
              <li>Séparez les postes par « et » ou une courte pause.</li>
              <li>
                Pas de phrases autour : évitez « j&apos;aimerais bien », « il me faut », « euh », « voilà ».
              </li>
            </ul>
            <p className="mt-2">
              Exemple : <em>« Pour Mme Peeters, 24 m² de carrelage à 40 euros, 4 mètres de tuyau cuivre, 2 sacs de colle et 6 heures de main-d&apos;œuvre »</em>.
            </p>
          </BotBubble>
          {s.messages.map((m) =>
            m.from === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-blue to-blue/80 px-3.5 py-2.5 text-[15px] leading-relaxed text-white theme-fixed">
                  {m.kind === "text" ? m.text : <VoiceBubble audioKey={m.audioKey} duration={m.duration} transcript={m.transcript} blobUrl={blobUrl} />}
                </div>
              </div>
            ) : m.kind === "preview" ? (
              m.id === lastPreview ? (
                <QuotePreview key={m.id} quoteId={m.quoteId} onOpen={() => onOpenDoc(m.quoteId)} money={f.money} />
              ) : (
                <p key={m.id} className="text-center text-xs text-slate-500">Devis mis à jour ↓</p>
              )
            ) : (
              <BotBubble key={m.id} tone={m.tone}>
                {m.text}
                {m.chips && m.id === s.messages[s.messages.length - 1]?.id && (
                  <span className="mt-2 flex flex-wrap gap-2">
                    {m.chips.map((c) => (
                      <button key={c} type="button" onClick={() => sendText(c)} className="min-h-10 rounded-full border border-white/15 px-3 text-sm text-slate-200 hover:border-cyan/50">
                        {c}
                      </button>
                    ))}
                  </span>
                )}
              </BotBubble>
            ),
          )}
          {busy && <TypingDots label="Biltov prépare le devis…" />}
        </div>

        {(rec.error || netError) && (
          <div role="alert" className="mx-3 mb-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            {rec.error ? RECORDER_ERROR_TEXT[rec.error] : netError}
            <span className="mt-2 flex gap-2">
              {rec.error && rec.error !== "no_mic" && rec.error !== "insecure" && (
                <button type="button" onClick={() => void rec.start()} className="btn-ghost !py-1.5 text-xs">
                  Réessayer
                </button>
              )}
              <button type="button" onClick={() => (rec.setError(null), setNetError(null))} className="btn-ghost !py-1.5 text-xs">
                Écrire plutôt
              </button>
            </span>
          </div>
        )}

        <div className="border-t border-white/10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {recording ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={rec.cancel} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-rose-300 hover:bg-rose-500/10" aria-label="Annuler l'enregistrement">
                <Trash2 className="h-5 w-5" />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2.5">
                <motion.span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                <span className="w-11 shrink-0 font-mono text-sm tabular-nums text-white" aria-label="Durée">{fmtTime(rec.elapsed)}</span>
                <span className="flex h-7 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
                  {rec.levels.map((v, i) => (
                    <span key={i} className="w-[3px] shrink-0 rounded-full bg-rose-300/90 transition-[height] duration-75" style={{ height: `${Math.max(12, v * 100)}%` }} />
                  ))}
                </span>
                {rec.elapsed > MAX_SECONDS - 15 && <span className="text-xs text-amber-200">max {MAX_SECONDS / 60} min</span>}
              </div>
              <button type="button" onClick={() => void finishRecording()} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald text-white shadow-[0_0_30px_-6px_rgba(16,185,129,0.8)] theme-fixed" aria-label="Envoyer le vocal">
                <ArrowUp className="h-6 w-6" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex min-w-0 flex-1 items-end rounded-3xl border border-white/10 bg-white/[0.03] px-2 focus-within:border-cyan">
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                  placeholder={s.pending?.kind === "price" ? "Prix en € HTVA…" : "Écrire un message…"}
                  aria-label="Écrire un message"
                  maxLength={2000}
                  className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-base text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
              {text.trim() ? (
                <button type="button" onClick={() => sendText()} disabled={busy} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald text-white disabled:opacity-50 theme-fixed" aria-label="Envoyer le message">
                  <ArrowUp className="h-6 w-6" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || rec.state === "requesting"}
                  onPointerDown={async (e) => {
                    e.preventDefault();
                    holdStart.current = Date.now();
                    await rec.start();
                  }}
                  onPointerUp={() => {
                    // maintenu (> 0,6 s) : envoi au relâchement ; simple appui : l'enregistrement continue
                    if (holdStart.current && Date.now() - holdStart.current > 600) void finishRecording();
                    holdStart.current = 0;
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex h-14 w-14 shrink-0 touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald text-white shadow-[0_0_30px_-6px_rgba(0,102,255,0.8)] disabled:opacity-50 theme-fixed"
                  aria-label="Appuyer pour enregistrer un vocal (ou maintenir)"
                >
                  {rec.state === "requesting" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
                </button>
              )}
            </div>
          )}
          {recording && rec.live && <p className="mt-2 line-clamp-2 px-2 text-xs italic text-slate-400">{rec.live}</p>}
          {!recording && <p className="mt-2 text-center text-[11px] text-slate-500">Appuyez sur le micro pour parler, ou maintenez-le comme sur WhatsApp.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

function BotBubble({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="flex justify-start">
      <div className={cn("max-w-[88%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[15px] leading-relaxed", tone === "error" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.04] text-slate-200")}>{children}</div>
    </div>
  );
}

/** Bulle de message vocal : lecteur (lecture dans la page) et transcription. */
function VoiceBubble({ audioKey, duration, transcript, blobUrl }: { audioKey: string | null; duration: number; transcript: string; blobUrl: (k: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const el = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioKey) void blobUrl(audioKey).then(setUrl);
  }, [audioKey, blobUrl]);
  return (
    <div className="min-w-[200px] space-y-1.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={!url}
          onClick={() => (playing ? el.current?.pause() : void el.current?.play())}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 disabled:opacity-40"
          aria-label={playing ? "Mettre en pause" : "Écouter le vocal"}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
          <span className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </span>
        <span className="text-xs tabular-nums text-white/80">{fmtTime(duration)}</span>
        {url && <audio ref={el} src={url} preload="metadata" playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => (setPlaying(false), setProgress(0))} onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || duration || 1))} />}
      </div>
      <p className="text-[13px] leading-snug text-white/85">{transcript ? `« ${transcript} »` : <span className="italic text-white/60">Transcription indisponible</span>}</p>
    </div>
  );
}

/** Aperçu du devis dans la conversation (toujours à jour, même après modification dans l'éditeur). */
function QuotePreview({ quoteId, onOpen, money }: { quoteId: string; onOpen: () => void; money: (n: number) => string }) {
  const { data } = useAppData();
  const q = data.docs.find((d) => d.id === quoteId);
  if (!q) return null;
  const t = computeTotals(q);
  const client = data.clients.find((c) => c.id === q.clientId);
  const items = q.lines.filter((l) => l.kind === "item");
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-cyan/30 bg-gradient-to-br from-blue/10 to-emerald/5 sm:max-w-md">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-cyan">Devis {q.number}</span>
            <span className="block truncate text-sm font-semibold text-white">{client?.name}</span>
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">{q.status === "draft" ? "Brouillon" : "Envoyé"}</span>
        </div>
        <ul className="divide-y divide-white/5 px-4 text-sm">
          {items.slice(0, 6).map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-slate-200">{l.label}</span>
                <span className="text-xs text-slate-500">
                  {l.qty} {l.unit} × {l.toPrice ? <span className="text-amber-300">à chiffrer</span> : money(l.unitPrice)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-200">{money(l.qty * l.unitPrice * (1 - (l.discountPercent || 0) / 100))}</span>
            </li>
          ))}
          {items.length > 6 && <li className="py-2 text-xs text-slate-500">+ {items.length - 6} autre(s) ligne(s)</li>}
        </ul>
        <dl className="space-y-1 border-t border-white/10 px-4 py-3 text-sm tabular-nums">
          <div className="flex justify-between text-slate-400">
            <dt>Total HTVA</dt>
            <dd>{money(t.htva)}</dd>
          </div>
          <div className="flex justify-between text-slate-400">
            <dt>TVA</dt>
            <dd>{money(t.vat)}</dd>
          </div>
          <div className="flex justify-between font-bold text-white">
            <dt>Total TVAC</dt>
            <dd className="text-cyan">{money(t.tvac)}</dd>
          </div>
        </dl>
        <div className="px-4 pb-4">
          <button type="button" onClick={onOpen} className="btn-primary w-full !py-3 text-sm">
            <FilePenLine className="h-4 w-4" /> Ouvrir / Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bouton d'entrée « Dictée vocale » (visible si l'utilisateur peut créer des devis). */
export function VoiceQuoteButton({ className, compact }: { className?: string; compact?: boolean }) {
  const { can } = useAppData();
  if (!can("quotes", "edit") || !can("jobs", "edit")) return null;
  return (
    <button type="button" onClick={openVoiceQuote} className={cn(compact ? "flex h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-cyan hover:bg-white/5" : "btn-primary !py-2.5 text-sm", className)} title="Créer un devis à la voix" aria-label="Dictée vocale">
      <Mic className="h-4 w-4" /> <span className={compact ? "hidden lg:inline" : ""}>Dictée vocale</span>
    </button>
  );
}
