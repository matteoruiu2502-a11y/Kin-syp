// Dictée vocale en conversation : interprétation locale des messages (description de travaux,
// réponses aux questions, corrections « change le prix de la peinture à 45 € », « ajoute 2 heures
// de main-d'œuvre », « supprime les plinthes »…) et questions sur les informations manquantes.
// Les mêmes actions servent aux interprétations du serveur IA (lib/ai.ts) : une seule logique d'application.

import { extractClient, parseQuote } from "../parseQuote";
import type { QuoteAction, QuoteInterpretation } from "../ai";
import { dictationToDetailedLines, dictationToLines, lineFromArticle } from "./catalog/dictation";
import { rankMatches, specNumbers } from "./catalog/match";
import { newLine } from "./defaults";
import { normalizeLabel, similarity } from "./materials";
import type { Article, Lang, Line, PriceList } from "./types";

export { extractClient };

/** Plusieurs articles également plausibles pour ce que l'artisan a dit : il doit choisir. */
export type Choice = { spoken: string; options: { articleId: string; label: string }[]; userPrice: number | null };
export type LineFlag = { qty?: true; choice?: Choice };
export type VoiceDraft = { client: string | null; lines: Line[]; flags?: Record<string, LineFlag> };
export type Pending = { kind: "client" } | { kind: "price"; lineId: string } | { kind: "qty"; lineId: string } | { kind: "choice"; lineId: string } | null;

/** Résultat de l'interprétation d'un message (le serveur IA ne renvoie que client, actions, reply). */
export type Interpretation = QuoteInterpretation & { newLines?: Line[]; replace?: Line[]; flags?: Record<string, LineFlag> };

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
  [/^(kg|kilos?)$/i, "kg"],
];
const unitOf = (raw?: string) => (raw ? (UNIT_WORDS.find(([re]) => re.test(raw.trim()))?.[1] ?? null) : null);

/** Message qui est une commande (et non la réponse à la question posée). */
const COMMAND = /^(?:ajoute|rajoute|supprime|enlève|enleve|retire|efface|change|modifie|mets|passe|corrige|le client|client)\b/i;

const money = (n: number) => `${n.toFixed(2).replace(".", ",").replace(/,00$/, "")} €`;
/** « 12 ml Tube cuivre Ø22 à 12,60 € » */
export const describeLine = (l: Line) => `${l.qty} ${l.unit} « ${l.label} »${l.toPrice ? " (prix à compléter)" : ` à ${money(l.unitPrice)} HTVA`}`;

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

export type Catalog = { articles: Article[]; lang: Lang; priceList?: PriceList; trade?: string };

/** Nouvelles lignes à partir d'une description libre (prix du catalogue, sinon « à chiffrer »). */
function linesFrom(text: string, cat: Catalog): Line[] {
  return dictationToLines(parseQuote(text, LABOUR), cat.articles, cat.lang, cat.priceList);
}

/** Choix de l'artisan parmi les options proposées : « le 22 », « Tube cuivre Ø22 », « le deuxième »… */
function pickOption(message: string, choice: Choice, cat: Catalog): Article | "none" | null {
  const arts = choice.options.map((o) => cat.articles.find((a) => a.id === o.articleId)).filter((a): a is Article => !!a);
  if (/\b(?:aucun|autre chose|ni l'un ni l'autre|aucune)\b/i.test(message)) return "none";
  // numéro d'ordre : « 1 », « le premier », « le deuxième », « le dernier »
  const ord = message.match(/^(?:le |la |l')?(?:num[ée]ro |n° |option )?(\d)$/i);
  const words: [RegExp, number][] = [[/\bpremi/i, 0], [/\b(?:deuxi|second)/i, 1], [/\btroisi/i, 2], [/\bquatri/i, 3]];
  const byWord = words.find(([re]) => re.test(message));
  const nums = specNumbers(message);
  if (nums.size) {
    // un diamètre ou une dimension qui désigne une seule option
    const hit = arts.filter((a) => [...nums].every((n) => specNumbers(a.name.fr).has(n)));
    if (hit.length === 1) return hit[0];
    if (ord && !hit.length && Number(ord[1]) >= 1 && Number(ord[1]) <= arts.length) return arts[Number(ord[1]) - 1];
  }
  if (byWord) return arts[byWord[1]] ?? null;
  if (/\bdernier|derni[èe]re\b/i.test(message)) return arts[arts.length - 1] ?? null;
  const ranked = rankMatches(message, arts, { threshold: 0.35 });
  if (ranked[0] && (!ranked[1] || ranked[0].confidence - ranked[1].confidence >= 0.1)) return ranked[0].article;
  return null;
}

/** Interprétation locale d'un message de l'artisan. */
export function interpretLocally(text: string, draft: VoiceDraft, pending: Pending, cat: Catalog): Interpretation {
  const clean = text.trim().replace(/\s+/g, " ");
  const none = (reply: string): Interpretation => ({ client: draft.client, actions: [], reply, newLines: [] });
  const upd = (lineId: string, patch: Partial<QuoteAction>): QuoteAction => ({ op: "update", lineId, label: null, qty: null, unit: null, unitPrice: null, ...patch });

  // Réponse à la question en attente
  if (pending?.kind === "client") {
    const c = extractClient(/^(?:pour|chez|c'est)\b/i.test(clean) ? clean : `pour ${clean.replace(/^./, (x) => x.toUpperCase())}`).client ?? clean;
    return { ...none(`Client : ${c}.`), client: c };
  }
  if (pending?.kind === "choice") {
    const line = draft.lines.find((l) => l.id === pending.lineId);
    const choice = draft.flags?.[pending.lineId]?.choice;
    if (line && choice) {
      const picked = pickOption(clean, choice, cat);
      const keepQty: LineFlag = draft.flags?.[line.id]?.qty ? { qty: true } : {}; // le choix de l'article ne règle pas « combien ? »
      if (picked === "none") {
        const free = { ...line, articleId: null, label: choice.spoken, confidence: 0, toPrice: choice.userPrice === null, unitPrice: choice.userPrice ?? 0, costPrice: 0 };
        return { client: draft.client, actions: [], reply: `D'accord, « ${choice.spoken} » reste une ligne libre : indiquez son prix.`, replace: [free], flags: { [line.id]: keepQty } };
      }
      if (picked) {
        const next = { ...lineFromArticle(picked, { qty: line.qty, unit: line.unit, price: choice.userPrice ?? 0, priceGiven: choice.userPrice !== null, unitAmbiguous: false }, cat.lang, cat.priceList, 1), id: line.id };
        return { client: draft.client, actions: [], reply: `C'est noté : ${describeLine(next)}.`, replace: [next], flags: { [line.id]: keepQty } };
      }
      if (!COMMAND.test(clean)) return none(`Je n'ai pas compris lequel : répondez par le nom, le diamètre ou « le premier », « le deuxième »…`);
    }
  }
  if (pending && (pending.kind === "price" || pending.kind === "qty")) {
    const n = clean.match(new RegExp(String.raw`${NUMBER}\s*([\p{L}²³]+)?`, "u"));
    const value = n ? num(n[1]) : null;
    if (value !== null && !/^(?:ajoute|supprime|change|modifie|mets)/i.test(clean)) {
      const line = draft.lines.find((l) => l.id === pending.lineId);
      const unit = pending.kind === "qty" && n ? unitOf(n[2]) : null;
      if (line) return { client: draft.client, actions: [upd(line.id, pending.kind === "price" ? { unitPrice: value } : { qty: value, unit })], reply: pending.kind === "price" ? `Prix de « ${line.label} » : ${money(value)} HTVA.` : `Quantité de « ${line.label} » : ${value} ${unit ?? line.unit}.`, newLines: [] };
    }
  }

  // Le client
  const clientCmd = clean.match(/^(?:le client (?:c'est|est)|client\s*:)\s*(.+)$/i);
  if (clientCmd) return { ...none(`Client : ${clientCmd[1]}.`), client: extractClient(`pour ${clientCmd[1].replace(/^./, (x) => x.toUpperCase())}`).client ?? clientCmd[1] };

  // Changer un prix : « change le prix de la peinture à 45 € »
  const price = clean.match(new RegExp(String.raw`^(?:change|modifie|mets|passe|corrige)\s+(?:le\s+)?prix\s+(?:unitaire\s+)?(?:de\s+la\s+|de\s+l'|du\s+|des\s+|de\s+|d')?(.+?)\s+(?:à|a|en|pour)\s+${NUMBER}`, "i"));
  if (price) {
    const line = findLine(draft.lines, price[1]);
    const v = num(price[2])!;
    return line ? { client: draft.client, actions: [upd(line.id, { unitPrice: v })], reply: `C'est noté : « ${line.label} » passe à ${money(v)} HTVA.`, newLines: [] } : none(`Je ne trouve pas « ${price[1]} » dans le devis.`);
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
    if (qty2) return addLines(`${v} ${unit ?? ""} de ${target}`, draft, cat);
    return none(`Je ne trouve pas « ${target} » dans le devis.`);
  }

  // Supprimer : « supprime les plinthes », « enlève la ligne peinture »
  const del = clean.match(/^(?:supprime|enlève|enleve|retire|efface)\s+(?:la\s+ligne\s+)?(.+)$/i);
  if (del) {
    const line = findLine(draft.lines, del[1]);
    return line ? { client: draft.client, actions: [{ op: "remove", lineId: line.id, label: null, qty: null, unit: null, unitPrice: null }], reply: `« ${line.label} » est retiré du devis.`, newLines: [] } : none(`Je ne trouve pas « ${del[1]} » dans le devis.`);
  }

  // Ajouter : « ajoute 2 heures de main-d'œuvre » ou description complète des travaux
  const add = clean.match(/^(?:ajoute|rajoute|ajouter|et aussi)\s+(.+)$/i);
  return addLines(add ? add[1] : clean, draft, cat);
}

/** Description de travaux → nouvelles lignes, avec les questions à poser (choix d'article, quantité manquante). */
function addLines(text: string, draft: VoiceDraft, cat: Catalog): Interpretation {
  const parsed = parseQuote(text, LABOUR);
  const client = parsed.client ?? draft.client;
  if (!parsed.lines.length) return { client, actions: [], reply: parsed.client ? `Client : ${parsed.client}.` : "Je n'ai pas compris quels travaux ajouter. Décrivez-les avec une quantité, par exemple « 12 m² de carrelage à 40 euros ».", newLines: [] };
  const detailed = dictationToDetailedLines(parsed, cat.articles, cat.lang, cat.priceList, cat.trade);
  const flags: Record<string, LineFlag> = {};
  detailed.forEach((d, i) => {
    const f: LineFlag = {};
    if (d.choices) f.choice = { spoken: d.spoken, options: d.choices.map((c) => ({ articleId: c.article.id, label: c.article.name[cat.lang] || c.article.name.fr })), userPrice: parsed.lines[i].priceGiven ? parsed.lines[i].price : null };
    if (d.qtyMissing) f.qty = true;
    if (f.choice || f.qty) flags[d.line.id] = f;
  });
  const lines = detailed.map((d) => d.line);
  const unsure = lines.filter((l) => l.confidence !== null && l.confidence > 0 && l.confidence < 0.7).map((l) => `« ${l.label} »`);
  const reply = [lines.length === 1 ? `J'ajoute ${describeLine(lines[0])}.` : `J'ajoute ${lines.length} lignes : ${lines.map(describeLine).join(" ; ")}.`, unsure.length ? `Je ne suis pas sûr pour ${unsure.join(", ")} : vérifiez-le dans le devis.` : ""].filter(Boolean).join(" ");
  return { client, actions: [], reply, newLines: lines, flags };
}

/** Applique des actions (locales ou du serveur) au brouillon. */
export function applyActions(draft: VoiceDraft, result: Pick<Interpretation, "client" | "actions" | "newLines" | "replace" | "flags">, cat: Catalog): VoiceDraft {
  let lines = [...draft.lines];
  const flags: Record<string, LineFlag> = { ...(draft.flags ?? {}) };
  for (const a of result.actions) {
    if (a.op === "remove") {
      lines = lines.filter((l) => l.id !== a.lineId);
      if (a.lineId) delete flags[a.lineId];
    } else if (a.op === "update" && a.lineId) {
      lines = lines.map((l) =>
        l.id !== a.lineId ? l : { ...l, ...(a.label ? { label: a.label } : {}), ...(a.qty !== null ? { qty: a.qty } : {}), ...(a.unit ? { unit: a.unit } : {}), ...(a.unitPrice !== null ? { unitPrice: a.unitPrice, toPrice: false } : {}) },
      );
      // quantité donnée : la question « combien ? » est réglée
      if (a.qty !== null && flags[a.lineId]) flags[a.lineId] = { ...flags[a.lineId], qty: undefined };
    } else if (a.op === "add" && a.label) {
      // le serveur décrit la ligne ; le catalogue fournit article, catégorie et prix de revient
      const [fromCatalog] = linesFrom(`${a.qty ?? 1} ${a.unit ?? ""} ${a.label}`, cat);
      const base = fromCatalog ?? newLine({ label: a.label, toPrice: true });
      lines.push({ ...base, label: a.label, qty: a.qty ?? base.qty, unit: a.unit ?? base.unit, ...(a.unitPrice !== null ? { unitPrice: a.unitPrice, toPrice: false } : {}) });
    }
  }
  for (const r of result.replace ?? []) lines = lines.map((l) => (l.id === r.id ? r : l));
  return { client: result.client ?? draft.client, lines: [...lines, ...(result.newLines ?? [])], flags: { ...flags, ...(result.flags ?? {}) } };
}

const ASK_QTY: Record<string, (l: Line) => string> = {
  ml: (l) => `Combien de mètres pour « ${l.label} » ?`,
  "m²": (l) => `Combien de m² pour « ${l.label} » ?`,
  "m³": (l) => `Combien de m³ pour « ${l.label} » ?`,
  h: (l) => `Combien d'heures pour « ${l.label} » ?`,
  j: (l) => `Combien de jours pour « ${l.label} » ?`,
  kg: (l) => `Combien de kg pour « ${l.label} » ?`,
};

export type Question = { pending: Exclude<Pending, null>; text: string; chips?: string[] };

/** Prochaine information à demander (une seule à la fois), sinon null : client, choix d'article, quantité, prix. */
export function nextQuestion(draft: VoiceDraft, skipped: string[] = []): Question | null {
  const items = draft.lines.filter((l) => l.kind === "item");
  if (!items.length) return null;
  if (!draft.client && !skipped.includes("client")) return { pending: { kind: "client" }, text: "Pour quel client est ce devis ? Donnez son nom (par exemple « Mme Peeters »)." };
  const open = (l: Line) => !skipped.includes(l.id);
  const choosing = items.find((l) => open(l) && draft.flags?.[l.id]?.choice);
  if (choosing) {
    const c = draft.flags![choosing.id].choice!;
    return { pending: { kind: "choice", lineId: choosing.id }, text: `Plusieurs articles correspondent à « ${c.spoken} ». Lequel ?`, chips: [...c.options.map((o) => o.label), "Aucun de ceux-là"] };
  }
  const noQty = items.find((l) => open(l) && (draft.flags?.[l.id]?.qty || !Number.isFinite(l.qty) || l.qty <= 0));
  if (noQty) return { pending: { kind: "qty", lineId: noQty.id }, text: (ASK_QTY[noQty.unit] ?? ((l: Line) => (l.unit === "u" ? `Quelle quantité (ou longueur) pour « ${l.label} » ? Par exemple « 12 mètres ».` : `Quelle quantité pour « ${l.label} » (en ${l.unit}) ?`)))(noQty) };
  const noPrice = items.find((l) => open(l) && (l.toPrice || !l.unitPrice));
  if (noPrice) return { pending: { kind: "price", lineId: noPrice.id }, text: `Quel est le prix unitaire de « ${noPrice.label} », en € HTVA par ${noPrice.unit} ? Il n'est ni dicté ni dans votre catalogue.` };
  return null;
}
