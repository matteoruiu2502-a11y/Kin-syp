// Rapprochement d'un libellé (dicté ou issu d'un métré) avec le catalogue de l'artisan.

import type { Article, Lang } from "../types";

const STOP = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "un", "une", "et", "en", "au", "aux", "pour", "sur", "avec", "van", "het", "een", "voor", "met", "der", "die", "das", "und", "mit", "für", "of", "the", "a"]);

/** Synonymes du jargon BTP (FR / NL / DE) ramenés à une forme commune. */
const SYNONYMS: Record<string, string> = {
  mo: "main-oeuvre",
  "main-d'oeuvre": "main-oeuvre",
  "main-d'œuvre": "main-oeuvre",
  arbeidsloon: "main-oeuvre",
  arbeid: "main-oeuvre",
  arbeitszeit: "main-oeuvre",
  heure: "main-oeuvre",
  heures: "main-oeuvre",
  uren: "main-oeuvre",
  stunden: "main-oeuvre",
  carrelage: "carrelage",
  tegels: "carrelage",
  fliesen: "carrelage",
  faience: "carrelage",
  peinture: "peinture",
  verf: "peinture",
  schilderwerk: "peinture",
  farbe: "peinture",
  prise: "prise",
  stopcontact: "prise",
  steckdose: "prise",
  plinthe: "plinthe",
  plinthes: "plinthe",
  plint: "plinthe",
  sockelleiste: "plinthe",
  parquet: "parquet",
  parket: "parquet",
  parkett: "parquet",
  boiler: "chauffe-eau",
  "chauffe-eau": "chauffe-eau",
  cumulus: "chauffe-eau",
  warmwaterboiler: "chauffe-eau",
  chaudiere: "chaudiere",
  ketel: "chaudiere",
  kessel: "chaudiere",
};

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9'\- ]+/g, " ");

export function tokens(s: string) {
  return normalize(s)
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => SYNONYMS[t] ?? (t.endsWith("s") && t.length > 4 ? t.slice(0, -1) : t));
}

const trigrams = (s: string) => {
  const t = `  ${normalize(s)} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};

function similarity(a: string, b: string) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const tokenScore = ta.size && tb.size ? inter / Math.min(ta.size, tb.size) : 0;
  const ga = trigrams(a);
  const gb = trigrams(b);
  const gi = [...ga].filter((x) => gb.has(x)).length;
  const triScore = (2 * gi) / (ga.size + gb.size || 1);
  return Math.max(tokenScore * 0.85 + triScore * 0.15, triScore);
}

export type Match = { article: Article; confidence: number };

/** Meilleure correspondance (toutes langues du catalogue + référence). Seuil par défaut : 0,45. */
export function bestMatch(label: string, articles: Article[], opts: { unit?: string; threshold?: number } = {}): Match | null {
  let best: Match | null = null;
  for (const a of articles) {
    if (!a.active) continue;
    const names = (Object.keys(a.name) as Lang[]).map((l) => a.name[l]).filter(Boolean);
    let score = Math.max(0, ...names.map((n) => similarity(label, n)));
    if (a.ref && normalize(label).includes(normalize(a.ref))) score = Math.max(score, 0.95);
    if (opts.unit && a.unit === opts.unit) score = Math.min(1, score + 0.05);
    if (!best || score > best.confidence) best = { article: a, confidence: Math.round(score * 100) / 100 };
  }
  return best && best.confidence >= (opts.threshold ?? 0.45) ? best : null;
}

export function searchArticles(query: string, articles: Article[]) {
  const q = normalize(query).trim();
  if (!q) return articles;
  return articles
    .map((a) => ({ a, s: Math.max(similarity(query, a.name.fr), similarity(query, a.name.nl), similarity(query, a.name.de), normalize(a.ref).includes(q) ? 1 : 0, normalize(a.family).includes(q) ? 0.6 : 0) }))
    .filter((x) => x.s >= 0.3)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}
