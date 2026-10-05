// Rapprochement d'un libellé (dicté ou issu d'un métré) avec le catalogue de l'artisan.

import type { Article, Lang } from "../types";

const STOP = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "un", "une", "et", "en", "au", "aux", "pour", "sur", "avec", "par", "à", "a", "van", "het", "een", "voor", "met", "der", "die", "das", "und", "mit", "für", "of", "the"]);

/** Gestes et verbes qui ne désignent pas le produit (« pose de », « remplacement de », « installation d' »). */
const ACTIONS = new Set(["installation", "installer", "pose", "poser", "fourniture", "fournir", "remplacement", "remplacer", "changement", "changer", "depose", "deposer", "creation", "creer", "mise", "place", "refection", "renovation", "raccordement", "montage", "monter", "prevoir"]);

/** Synonymes du jargon BTP (FR / NL / DE) ramenés à une forme commune. */
const SYNONYMS: Record<string, string> = {
  mo: "main-oeuvre", "main-oeuvre": "main-oeuvre", arbeidsloon: "main-oeuvre", arbeid: "main-oeuvre", arbeitszeit: "main-oeuvre", heure: "main-oeuvre", heures: "main-oeuvre", uren: "main-oeuvre", stunden: "main-oeuvre", travail: "main-oeuvre",
  carrelage: "carrelage", tegels: "carrelage", fliesen: "carrelage", faience: "carrelage", carreaux: "carrelage", carreau: "carrelage",
  peinture: "peinture", verf: "peinture", schilderwerk: "peinture", farbe: "peinture",
  prise: "prise", stopcontact: "prise", steckdose: "prise",
  plinthe: "plinthe", plint: "plinthe", sockelleiste: "plinthe",
  parquet: "parquet", parket: "parquet", parkett: "parquet",
  boiler: "chauffe-eau", "chauffe-eau": "chauffe-eau", cumulus: "chauffe-eau", warmwaterboiler: "chauffe-eau", ballon: "chauffe-eau",
  chaudiere: "chaudiere", ketel: "chaudiere", kessel: "chaudiere",
  // plomberie
  tuyau: "tube", tuyaux: "tube", tube: "tube", canalisation: "tube", conduite: "tube", buis: "tube", rohr: "tube", tuyauterie: "tube",
  per: "multicouche", multicouche: "multicouche", pex: "multicouche",
  toilette: "wc", toilettes: "wc", wc: "wc", cuvette: "wc",
  melangeur: "mitigeur", mitigeur: "mitigeur", mengkraan: "mitigeur",
  robinet: "robinet", kraan: "robinet", vanne: "robinet",
  radiateur: "radiateur", radiator: "radiateur", heizkorper: "radiateur",
  evier: "evier", lavabo: "lavabo", vasque: "lavabo", lavabos: "lavabo",
  disjoncteur: "disjoncteur", automaat: "disjoncteur", sicherung: "disjoncteur",
  cable: "cable", kabel: "cable", fil: "cable",
};

/** Expressions de plusieurs mots ramenées à un seul mot. */
const PHRASES: [RegExp, string][] = [
  [/\bmain[ -]?d['’ ]?\s?oeuvre\b/g, "main-oeuvre"],
  [/\bchauffe[ -]eau\b/g, "chauffe-eau"],
  [/\bmise en place\b/g, "installation"],
  [/\bporte[ -]serviettes?\b/g, "porte-serviettes"],
];

export const normalize = (s: string) => {
  let t = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/ø/g, " ")
    .replace(/[^a-z0-9'’\- ]+/g, " ");
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  return t;
};

/** Racine d'un mot : pluriels français (« coudes », « tuyaux », « chevaux »). */
const stem = (t: string) => (t.endsWith("aux") && t.length > 5 ? `${t.slice(0, -3)}al` : t.endsWith("s") && t.length > 3 && !t.endsWith("ss") ? t.slice(0, -1) : t.endsWith("x") && t.length > 4 ? t.slice(0, -1) : t);

const wordsOf = (s: string) =>
  normalize(s)
    .split(/[\s'’]+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 0 && !STOP.has(t));

/** Mots du texte (sans nombres), synonymes ramenés à une forme commune. */
export function tokens(s: string) {
  return wordsOf(s)
    .filter((t) => !/^\d+(?:[.,]\d+)?$/.test(t))
    .map((t) => SYNONYMS[t] ?? SYNONYMS[stem(t)] ?? stem(t))
    .filter((t) => t.length > 1);
}

type Word = { raw: string; canon: string };
/** Mots du texte avec leur forme brute (racine) et leur forme commune (synonymes) : le mot exact pèse plus que son synonyme. */
function wordPairs(s: string): Word[] {
  return wordsOf(s)
    .filter((t) => !/^\d+(?:[.,]\d+)?$/.test(t))
    .map((t) => ({ raw: stem(t), canon: SYNONYMS[t] ?? SYNONYMS[stem(t)] ?? stem(t) }))
    .filter((w) => w.canon.length > 1);
}

/** Proximité de deux mots : 1 identiques, jusqu'à 0,85 faute de frappe ; 0,75 × … si seul le synonyme coïncide. */
function pairMatch(q: Word, a: Word) {
  const direct = wordMatch(q.raw, a.raw);
  if (direct) return direct;
  return 0.75 * wordMatch(q.canon, a.canon);
}

/** Nombres du texte : diamètres, dimensions, puissances… (les « spécifications » du produit). */
export const specNumbers = (s: string) => new Set((normalize(s).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")));

const trigrams = (s: string) => {
  const t = `  ${normalize(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};

/** Distance d'édition bornée à 1 (fautes de frappe : « thermostatiqe »). */
function withinOne(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else (i++, j++);
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

/** Ressemblance de deux mots : 1 identiques, 0,85 faute de frappe ou début commun, sinon 0. */
function wordMatch(a: string, b: string) {
  if (a === b) return 1;
  if (a.length >= 5 && b.length >= 5 && withinOne(a, b)) return 0.85;
  if (a.length >= 4 && b.length >= 5 && (b.startsWith(a) || a.startsWith(b))) return 0.8;
  return 0;
}

// Fréquence des mots dans le catalogue : un mot rare (« thermostatique ») pèse plus qu'un mot courant (« tube »).
type Stats = { df: Map<string, number>; n: number };
const statsCache = new WeakMap<Article[], Stats>();
const articleWords = (a: Article) => new Set([...tokens(a.name.fr), ...tokens(a.name.nl), ...tokens(a.name.de)]);
function statsOf(articles: Article[]): Stats {
  const hit = statsCache.get(articles);
  if (hit) return hit;
  const df = new Map<string, number>();
  let n = 0;
  for (const a of articles) {
    if (!a.active) continue;
    n++;
    for (const t of articleWords(a)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const st = { df, n };
  statsCache.set(articles, st);
  return st;
}
const idf = (st: Stats, t: string) => Math.log(1 + st.n / (st.df.get(t) ?? 0.5));

/** Score d'un article pour une description dictée : mots (pondérés), spécifications chiffrées, unité. */
function scoreArticle(query: { words: Word[]; nums: Set<string>; text: string }, a: Article, st: Stats, opts: { unit?: string; unitAmbiguous?: boolean }): number {
  if (!query.words.length) return 0;
  let best = 0;
  for (const lang of Object.keys(a.name) as Lang[]) {
    const name = a.name[lang];
    if (!name) continue;
    const aw = wordPairs(name);
    if (!aw.length) continue;
    // couverture des mots dictés par l'article, et de l'article par les mots dictés
    let qSum = 0;
    let qHit = 0;
    for (const q of query.words) {
      const w = idf(st, q.canon);
      qSum += w;
      qHit += w * Math.max(0, ...aw.map((x) => pairMatch(q, x)));
    }
    let aSum = 0;
    let aHit = 0;
    for (const x of aw) {
      const w = idf(st, x.canon);
      aSum += w;
      aHit += w * Math.max(0, ...query.words.map((q) => pairMatch(q, x)));
    }
    let score = 0.75 * (qHit / (qSum || 1)) + 0.25 * (aHit / (aSum || 1));
    // spécifications : Ø22 ≠ Ø15, 100 ≠ 40
    const an = specNumbers(name);
    if (query.nums.size && an.size) {
      const inter = [...query.nums].filter((n) => an.has(n)).length;
      score *= inter === query.nums.size ? 1 : inter > 0 ? 0.8 : 0.5;
    } else if (query.nums.size && !an.size) score *= 0.92;
    else if (!query.nums.size && an.size) score *= 0.97;
    best = Math.max(best, score);
  }
  // unité dictée
  if (opts.unit) {
    if (a.unit === opts.unit) best += 0.06;
    else if (opts.unit === "h") best -= a.type === "labour" ? 0 : 0.3;
    else if (!opts.unitAmbiguous && ["ml", "m²", "m³", "kg"].includes(opts.unit) && ["ml", "m²", "m³", "kg", "h"].includes(a.unit)) best -= 0.12;
  }
  if (opts.unit === "h" && a.type === "labour") best += 0.08;
  return Math.max(0, Math.min(1, best));
}

/** Prépare la description dictée : gestes retirés (« pose de »), mots-clés et nombres séparés. */
function prepare(label: string) {
  const all = wordPairs(label);
  const core = wordPairs(wordsOf(label).filter((w) => !ACTIONS.has(w)).join(" "));
  // si le libellé ne contient que des gestes (« pose »), on les garde
  return { words: core.length ? core : all, nums: specNumbers(label), text: label };
}

export type Match = { article: Article; confidence: number };

// Index de recherche pour les gros catalogues de grossistes (Cebeo, Facq, BigMat… : dizaines de milliers d'articles).
// Construit une fois par version du catalogue ; la dictée ne compare ensuite que les meilleurs candidats.
type CatalogIndex = { tri: Map<string, number[]>; tok: Map<string, number[]> };
const indexCache = new WeakMap<Article[], CatalogIndex>();
const LINEAR_MAX = 1500;

function indexOf(articles: Article[]): CatalogIndex {
  const hit = indexCache.get(articles);
  if (hit) return hit;
  const tri = new Map<string, number[]>();
  const tok = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, i: number) => {
    const l = m.get(k);
    if (!l) m.set(k, [i]);
    else if (l[l.length - 1] !== i) l.push(i);
  };
  articles.forEach((a, i) => {
    const text = [a.name.fr, a.name.nl, a.name.de, a.ref].filter(Boolean).join(" ");
    for (const g of trigrams(text)) push(tri, g, i);
    for (const t of tokens(text)) push(tok, t, i);
  });
  const idx = { tri, tok };
  indexCache.set(articles, idx);
  return idx;
}

/** Articles candidats pour une recherche (tous si le catalogue est petit). */
export function candidates(label: string, articles: Article[], limit = 300): Article[] {
  if (articles.length <= LINEAR_MAX) return articles;
  const idx = indexOf(articles);
  const score = new Map<number, number>();
  for (const t of tokens(label)) for (const i of idx.tok.get(t) ?? []) score.set(i, (score.get(i) ?? 0) + 3);
  for (const g of trigrams(label)) for (const i of idx.tri.get(g) ?? []) score.set(i, (score.get(i) ?? 0) + 1);
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([i]) => articles[i]);
}

export type MatchOptions = { unit?: string; unitAmbiguous?: boolean; threshold?: number; trade?: string };

/** Articles classés du plus au moins proche de la description (seuil par défaut : 0,5). */
export function rankMatches(label: string, articles: Article[], opts: MatchOptions = {}): Match[] {
  const st = statsOf(articles);
  const q = prepare(label);
  const nLabel = normalize(label);
  const out: Match[] = [];
  for (const a of candidates(label, articles)) {
    if (!a.active) continue;
    let score = scoreArticle(q, a, st, opts);
    if (a.ref && nLabel.includes(normalize(a.ref))) score = Math.max(score, 0.95);
    if (opts.trade && a.trade === opts.trade) score = Math.min(1, score + 0.02); // à score égal, le métier de l'entreprise l'emporte
    out.push({ article: a, confidence: Math.round(score * 100) / 100 });
  }
  const threshold = opts.threshold ?? 0.5;
  return out.filter((m) => m.confidence >= threshold).sort((x, y) => y.confidence - x.confidence);
}

/** Meilleure correspondance (toutes langues du catalogue + référence). */
export function bestMatch(label: string, articles: Article[], opts: MatchOptions = {}): Match | null {
  return rankMatches(label, articles, opts)[0] ?? null;
}

/**
 * Plusieurs articles également plausibles (« tuyau cuivre » : Ø15 ou Ø22 ?) : l'artisan doit choisir.
 * Renvoie ces candidats (2 à 4), sinon null.
 */
export function ambiguousMatches(ranked: Match[], gap = 0.08, trade?: string): Match[] | null {
  if (ranked.length < 2) return null;
  const close = ranked.filter((m) => ranked[0].confidence - m.confidence < gap).slice(0, 4);
  if (close.length < 2) return null;
  // des doublons du catalogue (même nom, même unité) ne sont pas un vrai choix
  const distinct = new Map(close.map((m) => [`${normalize(m.article.name.fr)}|${m.article.unit}`, m]));
  if (distinct.size < 2) return null;
  // un seul des candidats est du métier de l'entreprise (« main-d'œuvre » : plombier, pas carreleur) : pas de question
  if (trade && close.filter((m) => m.article.trade === trade).length === 1) return null;
  return [...distinct.values()];
}

export function searchArticles(query: string, articles: Article[]) {
  const q = normalize(query).trim();
  if (!q) return articles;
  const st = statsOf(articles);
  const prepared = prepare(query);
  return candidates(query, articles, 500)
    .map((a) => ({ a, s: Math.max(scoreArticle(prepared, a, st, {}), normalize(a.ref).includes(q) ? 1 : 0, normalize(a.family).includes(q) ? 0.6 : 0) }))
    .filter((x) => x.s >= 0.3)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}
