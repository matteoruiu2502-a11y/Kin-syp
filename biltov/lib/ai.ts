// Client de la fonction serveur IA (supabase/functions/biltov-ai). La clé de l'API reste côté serveur :
// le navigateur n'appelle que NEXT_PUBLIC_AI_ENDPOINT. Sans adresse configurée, tout fonctionne en
// mode local (réponses tirées de la base de connaissances, analyse locale de la dictée).

import { FEATURES, TROUBLESHOOTING, searchKnowledge } from "./knowledge/features";

export const AI_ENDPOINT = (process.env.NEXT_PUBLIC_AI_ENDPOINT || "").replace(/\/$/, "");
export const aiOnline = () => Boolean(AI_ENDPOINT);

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AiErrorCode = "network" | "rate_limited" | "busy" | "server";

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
  }
}

const errorFromStatus = (status: number): AiErrorCode => (status === 429 ? "rate_limited" : status === 503 ? "busy" : "server");

export const AI_ERROR_TEXT: Record<AiErrorCode, string> = {
  network: "Connexion impossible. Vérifiez votre réseau puis réessayez.",
  rate_limited: "Vous avez envoyé beaucoup de messages. Patientez quelques minutes avant de réessayer.",
  busy: "L'assistant est très sollicité en ce moment. Réessayez dans un instant.",
  server: "Une erreur est survenue de notre côté. Réessayez dans un instant.",
};

const MAX_HISTORY = 20;
const MAX_CHARS = 2000;

/** Réponse du chat d'aide, transmise morceau par morceau à `onDelta`. */
export async function askHelp(history: ChatMessage[], onDelta: (text: string) => void, signal?: AbortSignal): Promise<void> {
  const messages = history.slice(-MAX_HISTORY).map((m) => ({ ...m, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!AI_ENDPOINT) return streamLocally(localHelpAnswer(messages[messages.length - 1]?.content ?? ""), onDelta, signal);

  let res: Response;
  try {
    res = await fetch(`${AI_ENDPOINT}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw new AiError("network");
  }
  if (!res.ok || !res.body) throw new AiError(errorFromStatus(res.status));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk.includes("[[erreur]]")) throw new AiError("server");
      onDelta(chunk);
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
    if ((e as Error).name === "AbortError") return;
    throw new AiError("network");
  }
}

/** Affichage progressif d'une réponse locale (même rendu que le streaming du serveur). */
async function streamLocally(text: string, onDelta: (t: string) => void, signal?: AbortSignal) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (let i = 0; i < parts.length; i += 3) {
    if (signal?.aborted) return;
    onDelta(parts.slice(i, i + 3).join(""));
    await new Promise((r) => setTimeout(r, 18));
  }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Réponse sans IA générative : fiche(s) de la base de connaissances les plus proches de la question. */
export function localHelpAnswer(question: string): string {
  const q = norm(question);
  const trouble = TROUBLESHOOTING.find((t) => {
    const words = norm(t.q).split(/\W+/).filter((w) => w.length > 3);
    return words.filter((w) => q.includes(w)).length >= Math.min(2, words.length);
  });
  if (trouble) return `**${trouble.q}**\n\n${trouble.a}`;

  const [best, second] = searchKnowledge(question, 2);
  if (!best) {
    const popular = ["dictee-vocale", "devis", "factures", "argent-a-recevoir"].map((slug) => FEATURES.find((f) => f.slug === slug)!);
    return `Je n'ai pas trouvé la réponse dans l'aide de Biltov. Reformulez avec un mot-clé (devis, facture, relance, planning, équipe…), ou consultez un guide :\n\n${popular.map((f) => `- [${f.title}](/fonctionnalites/${f.slug}/)`).join("\n")}\n\nToutes les fonctionnalités : [Fonctionnalités](/fonctionnalites/).`;
  }
  // « où … ? » : l'emplacement d'abord ; « combien / pourquoi / marche pas » : le cas particulier d'abord
  const where = /^(?:ou|où)\b|\bou (?:est|se trouve|trouver|je trouve)\b|\bou (?:changer|modifier|mettre|voir)\b/i.test(q) || /\bou (?:est|se trouve|trouver|changer|modifier|mettre|voir)\b/.test(q);
  const problem = /(marche pas|fonctionne pas|bloqu|erreur|impossible|disparu|probleme|bug|ne s'ouvre|ne veut pas)/.test(q);
  const lines: string[] = [];
  if (where) lines.push(`**${best.title}** — ${best.where}`, "", `Pour l'utiliser :`, ...best.steps.slice(0, 4).map((s, i) => `${i + 1}. ${s}`));
  else if (problem && best.notes.length) lines.push(`**${best.title}**`, "", ...best.notes.slice(0, 2).map((n) => `- ${n}`), "", `**Où :** ${best.where}`);
  else {
    lines.push(`**${best.title}** — ${best.what}`, "", `**Où :** ${best.where}`, "", ...best.steps.map((s, i) => `${i + 1}. ${s}`));
    if (best.notes[0]) lines.push("", `À savoir : ${best.notes[0]}`);
  }
  lines.push("", `[Voir le guide : ${best.title}](/fonctionnalites/${best.slug}/)`);
  if (second) lines.push(`Voir aussi : [${second.title}](/fonctionnalites/${second.slug}/)`);
  return lines.join("\n");
}

export const HELP_SUGGESTIONS = ["Comment créer un devis à la voix ?", "Comment relancer un client qui n'a pas payé ?", "Comment ajouter un ouvrier avec un code PIN ?", "Où sont enregistrées mes données ?"];

// ── Dictée vocale ──────────────────────────────────────────────────────────

export type QuoteAction = { op: "add" | "update" | "remove"; lineId: string | null; label: string | null; qty: number | null; unit: string | null; unitPrice: number | null };
export type QuoteInterpretation = { client: string | null; actions: QuoteAction[]; reply: string };
export type QuoteDraftLine = { id: string; label: string; qty: number; unit: string; unitPrice: number };

/** Interprétation d'un message de dictée par le serveur (null si non configuré : l'analyse locale prend le relais). */
export async function interpretWithAi(input: { text: string; draft: { client: string | null; lines: QuoteDraftLine[] }; catalog: { label: string; unit: string; price: number }[]; pending: string | null }, signal?: AbortSignal): Promise<QuoteInterpretation | null> {
  if (!AI_ENDPOINT) return null;
  let res: Response;
  try {
    res = await fetch(`${AI_ENDPOINT}/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  } catch {
    throw new AiError("network");
  }
  if (res.status === 422) return null;
  if (!res.ok) throw new AiError(errorFromStatus(res.status));
  return (await res.json()) as QuoteInterpretation;
}

