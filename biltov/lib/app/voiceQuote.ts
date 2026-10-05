// Dictée vocale en conversation : interprétation locale des messages (description de travaux,
// réponses aux questions, corrections « change le prix de la peinture à 45 € », « ajoute 2 heures
// de main-d'œuvre », « supprime les plinthes »…) et questions sur les informations manquantes.
// Les mêmes actions servent aux interprétations du serveur IA (lib/ai.ts) : une seule logique d'application.

import { parseQuote } from "../parseQuote";
import type { QuoteAction, QuoteInterpretation } from "../ai";
import { dictationToLines } from "./catalog/dictation";
import { newLine } from "./defaults";
import { normalizeLabel, similarity } from "./materials";
import type { Article, Lang, Line, PriceList } from "./types";

export type VoiceDraft = { client: string | null; lines: Line[] };
export type Pending = { kind: "client" } | { kind: "price"; lineId: string } | { kind: "qty"; lineId: string } | null;

const LABOUR = "Main-d'œuvre";
const num = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT_WORDS: [RegExp, string][] = [
  [/^(m²|m2|mètres? carrés?)$/i, "m²"],
  [/^(m³|m3|mètres? cubes?)$/i, "m³"],
  [/^(ml|mètres?( linéaires?)?)$/i, "ml"],
  [/^(h|heures?)$/i, "h"],
  [/^(jours?|j)$/i, "j"],
];
const unitOf = (raw?: string) => (raw ? (UNIT_WORDS.find(([re]) => re.test(raw.trim()))?.[1] ?? null) : null);

/** Nom du client dicté : « pour Madame Peeters, … », « le client c'est M. Dubois ». */
export function extractClient(text: string): { client: string | null; rest: string } {
  // mots-outils insensibles à la casse ; le nom, lui, commence par une majuscule (transcription)
  const m = text.match(/^\s*(?:[Cc]'est\s+)?(?:[Pp]our|[Cc]hez)\s+((?:[Mm]adame|[Mm]onsieur|[Mm]ademoiselle|[Mm]me|[Mm]lle|M\.|M|[Mm]r|[Ll]a [Ss]ociété|[Ll]'entreprise|[Ll]a [Ss]rl|[Ll]a [Ss]prl)\s+)?([A-ZÀ-Ý][\p{L}'’-]+(?:\s+(?:&\s+)?[A-ZÀ-Ý][\p{L}'’-]+)*)\s*[,:;.-]?\s*/u);
  if (!m) return { client: null, rest: text };
  const title = (m[1] ?? "").trim().toLowerCase();
  const civ = title.startsWith("madame") || title === "mme" ? "Mme " : title.startsWith("mademoiselle") || title === "mlle" ? "Mlle " : title.startsWith("monsieur") || title === "m." || title === "m" || title === "mr" ? "M. " : m[1] ? `${m[1].trim().replace(/^./, (c) => c.toUpperCase())} ` : "";
  return { client: `${civ}${m[2]}`.trim(), rest: text.slice(m[0].length) };
}

/** Ligne du devis désignée par une description approximative (« la peinture », « les plinthes »). */
export function findLine(lines: Line[], target: string): Line | null {
  const t = normalizeLabel(target.replace(/^(?:la|le|les|l'|du|de la|des|de|d')\s*/i, ""));
  if (!t) return null;
  let best: Line | null = null;
  let score = 0;
  for (const l of lines.filter((x) => x.kind === "item")) {
    const k = normalizeLabel(l.label);
    const s = k.includes(t) || t.includes(k) ? 0.95 : similarity(t, k);
    if (s > score) ((score = s), (best = l));
  }
  return score >= 0.5 ? best : null;
}

export type Catalog = { articles: Article[]; lang: Lang; priceList?: PriceList };

/** Nouvelles lignes à partir d'une description libre (prix du catalogue, sinon « à chiffrer »). */
function linesFrom(text: string, cat: Catalog): Line[] {
  return dictationToLines(parseQuote(text, LABOUR), cat.articles, cat.lang, cat.priceList);
}

/** Interprétation locale d'un message de l'artisan. */
export function interpretLocally(text: string, draft: VoiceDraft, pending: Pending, cat: Catalog): QuoteInterpretation & { newLines: Line[] } {
  const clean = text.trim().replace(/\s+/g, " ");
  const none = (reply: string): QuoteInterpretation & { newLines: Line[] } => ({ client: draft.client, actions: [], reply, newLines: [] });
  const upd = (lineId: string, patch: Partial<QuoteAction>): QuoteAction => ({ op: "update", lineId, label: null, qty: null, unit: null, unitPrice: null, ...patch });

  // Réponse à la question en attente
  if (pending?.kind === "client") {
    const c = extractClient(/^(?:pour|chez|c'est)\b/i.test(clean) ? clean : `pour ${clean.replace(/^./, (c) => c.toUpperCase())}`).client ?? clean;
    return { ...none(`Client : ${c}.`), client: c };
  }
  if (pending && (pending.kind === "price" || pending.kind === "qty")) {
    const n = clean.match(new RegExp(NUMBER));
    const value = n ? num(n[1]) : null;
    if (value !== null && !/^(?:ajoute|supprime|change|modifie|mets)/i.test(clean)) {
      const line = draft.lines.find((l) => l.id === pending.lineId);
      if (line) return { client: draft.client, actions: [upd(line.id, pending.kind === "price" ? { unitPrice: value } : { qty: value })], reply: pending.kind === "price" ? `Prix de « ${line.label} » : ${value} € HTVA.` : `Quantité de « ${line.label} » : ${value}.`, newLines: [] };
    }
  }

  // Le client
  const clientCmd = clean.match(/^(?:le client (?:c'est|est)|client\s*:)\s*(.+)$/i);
  if (clientCmd) return { ...none(`Client : ${clientCmd[1]}.`), client: extractClient(`pour ${clientCmd[1].replace(/^./, (c) => c.toUpperCase())}`).client ?? clientCmd[1] };

  // Changer un prix : « change le prix de la peinture à 45 € »
  const price = clean.match(new RegExp(String.raw`^(?:change|modifie|mets|passe|corrige)\s+(?:le\s+)?prix\s+(?:unitaire\s+)?(?:de\s+la\s+|de\s+l'|du\s+|des\s+|de\s+|d')?(.+?)\s+(?:à|a|en|pour)\s+${NUMBER}`, "i"));
  if (price) {
    const line = findLine(draft.lines, price[1]);
    const v = num(price[2])!;
    return line ? { client: draft.client, actions: [upd(line.id, { unitPrice: v })], reply: `C'est noté : « ${line.label} » passe à ${v} € HTVA.`, newLines: [] } : none(`Je ne trouve pas « ${price[1]} » dans le devis.`);
  }

  // Changer une quantité : « change la quantité de parquet à 30 », « mets 30 m² de parquet »
  const qty = clean.match(new RegExp(String.raw`^(?:change|modifie|mets|passe|corrige)\s+(?:la\s+)?quantité\s+(?:de\s+la\s+|de\s+l'|du\s+|des\s+|de\s+|d')?(.+?)\s+(?:à|a)\s+${NUMBER}\s*([\p{L}²³]+)?`, "iu")) ?? null;
  const qty2 = qty ? null : clean.match(new RegExp(String.raw`^(?:mets|passe|corrige)\s+${NUMBER}\s*([\p{L}²³]+(?:\s+carrés?|\s+cubes?|\s+linéaires?)?)?\s+(?:de\s+la\s+|de\s+l'|du\s+|des\s+|de\s+|d')(.+)$`, "iu"));
  if (qty || qty2) {
    const target = qty ? qty[1] : qty2![3];
    const v = num(qty ? qty[2] : qty2![1])!;
    const unit = unitOf(qty ? qty[3] : qty2![2]) ?? undefined;
    const line = findLine(draft.lines, target);
    if (line) return { client: draft.client, actions: [upd(line.id, { qty: v, unit: unit ?? null })], reply: `C'est noté : ${v}${unit ? ` ${unit}` : ""} pour « ${line.label} ».`, newLines: [] };
    if (qty2) {
      const newLines = linesFrom(`${v} ${unit ?? ""} de ${target}`, cat);
      return { client: draft.client, actions: [], reply: `J'ajoute ${newLines.map((l) => `« ${l.label} »`).join(", ")}.`, newLines };
    }
    return none(`Je ne trouve pas « ${target} » dans le devis.`);
  }

  // Supprimer : « supprime les plinthes », « enlève la ligne peinture »
  const del = clean.match(/^(?:supprime|enlève|enleve|retire|efface)\s+(?:la\s+ligne\s+)?(.+)$/i);
  if (del) {
    const line = findLine(draft.lines, del[1]);
    return line ? { client: draft.client, actions: [{ op: "remove", lineId: line.id, label: null, qty: null, unit: null, unitPrice: null }], reply: `« ${line.label} » est retiré du devis.`, newLines: [] } : none(`Je ne trouve pas « ${del[1]} » dans le devis.`);
  }

  // Ajouter : « ajoute 2 heures de main-d'œuvre »
  const add = clean.match(/^(?:ajoute|rajoute|ajouter|et aussi)\s+(.+)$/i);
  const { client, rest } = extractClient(add ? add[1] : clean);
  const newLines = linesFrom(rest, cat);
  if (!newLines.length) return { ...none(client ? `Client : ${client}.` : "Je n'ai pas compris quels travaux ajouter. Décrivez-les avec une quantité, par exemple « 12 m² de carrelage à 40 euros »."), client: client ?? draft.client };
  return { client: client ?? draft.client, actions: [], reply: `J'ajoute ${newLines.map((l) => `« ${l.label} »`).join(", ")}.`, newLines };
}

/** Applique des actions (locales ou du serveur) au brouillon. */
export function applyActions(draft: VoiceDraft, result: { client: string | null; actions: QuoteAction[]; newLines?: Line[] }, cat: Catalog): VoiceDraft {
  let lines = [...draft.lines];
  for (const a of result.actions) {
    if (a.op === "remove") lines = lines.filter((l) => l.id !== a.lineId);
    else if (a.op === "update" && a.lineId)
      lines = lines.map((l) =>
        l.id !== a.lineId ? l : { ...l, ...(a.label ? { label: a.label } : {}), ...(a.qty !== null ? { qty: a.qty } : {}), ...(a.unit ? { unit: a.unit } : {}), ...(a.unitPrice !== null ? { unitPrice: a.unitPrice, toPrice: false } : {}) },
      );
    else if (a.op === "add" && a.label) {
      // le serveur décrit la ligne ; le catalogue fournit article, catégorie et prix de revient
      const [fromCatalog] = linesFrom(`${a.qty ?? 1} ${a.unit ?? ""} ${a.label}`, cat);
      const base = fromCatalog ?? newLine({ label: a.label, toPrice: true });
      lines.push({ ...base, label: a.label, qty: a.qty ?? base.qty, unit: a.unit ?? base.unit, ...(a.unitPrice !== null ? { unitPrice: a.unitPrice, toPrice: false } : {}) });
    }
  }
  return { client: result.client ?? draft.client, lines: [...lines, ...(result.newLines ?? [])] };
}

/** Prochaine information à demander (une seule à la fois), sinon null. */
export function nextQuestion(draft: VoiceDraft, skipped: string[] = []): { pending: Pending; text: string } | null {
  if (!draft.lines.some((l) => l.kind === "item")) return null;
  if (!draft.client && !skipped.includes("client")) return { pending: { kind: "client" }, text: "Pour quel client est ce devis ? Donnez son nom (par exemple « Mme Peeters »)." };
  const noQty = draft.lines.find((l) => l.kind === "item" && !skipped.includes(l.id) && (!Number.isFinite(l.qty) || l.qty <= 0));
  if (noQty) return { pending: { kind: "qty", lineId: noQty.id }, text: `Quelle quantité pour « ${noQty.label} » (en ${noQty.unit}) ?` };
  const noPrice = draft.lines.find((l) => l.kind === "item" && !skipped.includes(l.id) && (l.toPrice || !l.unitPrice));
  if (noPrice) return { pending: { kind: "price", lineId: noPrice.id }, text: `Quel est le prix unitaire de « ${noPrice.label} », en € HTVA par ${noPrice.unit} ? Il n'est ni dicté ni dans votre catalogue.` };
  return null;
}
