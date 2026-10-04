// Matériaux : quantités prévues au devis contre quantités réellement achetées pour le chantier.
// Regroupement par description : les lignes de même description (après normalisation des
// majuscules, accents, espaces, ponctuation et pluriels) forment un seul matériau. Les descriptions
// proches (fautes de frappe) sont rapprochées automatiquement ; l'artisan peut aussi associer
// ou dissocier une description à la main (mémorisé sur le chantier).

import { round2 } from "./money";
import type { AccountData, Line } from "./types";

/** Description normalisée : « Carrelage  60x60 Gris » ≡ « carrelage 60X60 gris » ≡ « Carrelages 60x60 gris ». */
export function normalizeLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/(\d)([a-z])/g, "$1 $2") // « 5kg » ≡ « 5 kg »
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 3 && /[sx]$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w))
    .join(" ");
}

const bigrams = (s: string) => {
  const t = ` ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
  return out;
};

/** Ressemblance de deux descriptions normalisées (0 à 1) : lettres (fautes de frappe) et mots communs (mot ajouté). */
export function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const dice = diceSimilarity(a, b);
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  const shorter = ta.size <= tb.size ? ta : tb;
  const longer = shorter === ta ? tb : ta;
  // tous les mots de la description la plus courte (au moins 2) se retrouvent dans l'autre
  const contained = shorter.size >= 2 ? [...shorter].filter((w) => longer.has(w)).length / shorter.size : 0;
  return Math.max(dice, (dice + contained) / 2);
}

function diceSimilarity(a: string, b: string) {
  const A = bigrams(a);
  const B = bigrams(b);
  let common = 0;
  let total = 0;
  for (const [k, n] of A) {
    common += Math.min(n, B.get(k) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return (2 * common) / total;
}

/** Seuil de rapprochement automatique des descriptions proches. */
export const AUTO_MATCH = 0.82;

export type MaterialSource = "invoices" | "deliveries" | "stock";

export type ActualLine = { key: string; label: string; qty: number; cost: number; origin: string; source: MaterialSource; articleId: string | null };

export type MaterialRow = {
  key: string; // description normalisée du devis (ou de l'achat non prévu)
  label: string; // description affichée
  unit: string;
  plannedQty: number;
  actualQty: number;
  plannedCost: number;
  actualCost: number;
  qtyGap: number;
  qtyGapPercent: number | null; // null si rien de prévu
  costGap: number;
  status: "over" | "under" | "equal" | "unplanned" | "not_bought";
  plannedLabels: string[]; // descriptions regroupées côté devis
  actual: (ActualLine & { match: "exact" | "article" | "auto" | "manual"; score: number })[];
};

export type MaterialComparison = { rows: MaterialRow[]; unplanned: MaterialRow[]; plannedCost: number; actualCost: number; overCount: number; underCount: number };

/** Lignes de matériaux d'un devis : ni main-d'œuvre, ni sous-traitance. */
export function isMaterialLine(d: Pick<AccountData, "articles">, l: Line) {
  if (l.kind !== "item" || (l.optional && !l.selected) || l.executedBy) return false;
  const art = l.articleId ? d.articles.find((a) => a.id === l.articleId) : undefined;
  if (art && (art.type === "labour" || art.type === "subcontract")) return false;
  return l.category !== "labour" && !(l.unit === "h" && !art);
}

/** Liens manuels mémorisés : description achetée (normalisée) → matériau du devis, ou « __none » pour dissocier. */
export type MaterialLinks = Record<string, string>;
export const UNLINKED = "__none";

export function materialComparison(d: AccountData, jobId: string, opts: { quoteIds: string[]; sources: MaterialSource[]; links?: MaterialLinks }): MaterialComparison {
  const links = opts.links ?? {};
  // Prévu
  const planned = new Map<string, { label: string; unit: string; qty: number; cost: number; labels: Set<string>; articleIds: Set<string> }>();
  const add = (label: string, unit: string, qty: number, cost: number, articleId: string | null) => {
    const key = normalizeLabel(label);
    if (!key) return;
    const g = planned.get(key) ?? { label: label.trim(), unit, qty: 0, cost: 0, labels: new Set<string>(), articleIds: new Set<string>() };
    g.qty += qty;
    g.cost += cost;
    g.labels.add(label.trim());
    if (articleId) g.articleIds.add(articleId);
    planned.set(key, g);
  };
  for (const q of d.docs.filter((x) => opts.quoteIds.includes(x.id)))
    for (const l of q.lines.filter((x) => isMaterialLine(d, x))) {
      // ouvrage composé : ses fournitures (hors main-d'œuvre), quantités × quantité de la ligne
      const art = l.articleId ? d.articles.find((a) => a.id === l.articleId) : undefined;
      const parts = art?.type === "package" ? art.components.map((c) => ({ c, a: d.articles.find((x) => x.id === c.articleId) })).filter((x) => x.a && x.a.type !== "labour" && x.a.type !== "subcontract") : [];
      if (parts.length) for (const { c, a } of parts) add(a!.name.fr, a!.unit, (l.qty || 0) * c.qty, (l.qty || 0) * c.qty * a!.purchasePrice, a!.id);
      else add(l.label, l.unit, l.qty || 0, (l.costPrice || 0) * (l.qty || 0), l.articleId);
    }

  // Réel
  const actual: ActualLine[] = [];
  const purchases = d.purchases.filter((p) => p.jobId === jobId && !d.suppliers.some((s) => s.id === p.supplierId && s.kind === "subcontractor"));
  const supplierName = (id: string) => d.suppliers.find((s) => s.id === id)?.name ?? "";
  for (const p of purchases) {
    const source: MaterialSource | null = p.type === "invoice" ? "invoices" : p.type === "delivery" ? "deliveries" : null;
    if (!source || !opts.sources.includes(source)) continue;
    for (const l of p.lines) actual.push({ key: normalizeLabel(l.label), label: l.label.trim(), qty: l.qty || 0, cost: (l.qty || 0) * (l.unitPrice || 0), origin: `${p.number} · ${supplierName(p.supplierId)}`, source, articleId: l.articleId });
  }
  if (opts.sources.includes("stock"))
    for (const m of d.stockMoves.filter((x) => x.jobId === jobId && x.qty < 0)) {
      const art = d.articles.find((a) => a.id === m.articleId);
      if (!art) continue;
      actual.push({ key: normalizeLabel(art.name.fr), label: art.name.fr, qty: -m.qty, cost: -m.qty * art.purchasePrice, origin: m.reason || "Stock", source: "stock", articleId: art.id });
    }

  // Rapprochement : lien manuel → même article → même description → description proche
  const plannedKeys = [...planned.keys()];
  const rows = new Map<string, MaterialRow>();
  const unplanned = new Map<string, MaterialRow>();
  const blank = (key: string, label: string, unit: string): MaterialRow => ({ key, label, unit, plannedQty: 0, actualQty: 0, plannedCost: 0, actualCost: 0, qtyGap: 0, qtyGapPercent: null, costGap: 0, status: "equal", plannedLabels: [], actual: [] });
  for (const [key, g] of planned) rows.set(key, { ...blank(key, g.label, g.unit), plannedQty: g.qty, plannedCost: g.cost, plannedLabels: [...g.labels] });

  for (const a of actual) {
    let target: string | null = null;
    let match: "exact" | "article" | "auto" | "manual" = "exact";
    let score = 1;
    const manual = links[a.key];
    if (manual === UNLINKED) target = null;
    else if (manual && planned.has(manual)) ((target = manual), (match = "manual"));
    else if (planned.has(a.key)) target = a.key;
    else if (a.articleId && plannedKeys.some((k) => planned.get(k)!.articleIds.has(a.articleId!))) ((target = plannedKeys.find((k) => planned.get(k)!.articleIds.has(a.articleId!))!), (match = "article"));
    else {
      let best = 0;
      for (const k of plannedKeys) {
        const s = similarity(a.key, k);
        if (s > best) ((best = s), (target = k));
      }
      if (best >= AUTO_MATCH) ((match = "auto"), (score = Math.round(best * 100) / 100));
      else target = null;
    }
    const row = target ? rows.get(target)! : (unplanned.get(a.key) ?? unplanned.set(a.key, blank(a.key, a.label, "")).get(a.key)!);
    row.actualQty += a.qty;
    row.actualCost += a.cost;
    row.actual.push({ ...a, match, score });
  }

  const finish = (r: MaterialRow, isPlanned: boolean): MaterialRow => {
    const plannedQty = round2(r.plannedQty);
    const actualQty = round2(r.actualQty);
    const qtyGap = round2(actualQty - plannedQty);
    const status: MaterialRow["status"] = !isPlanned ? "unplanned" : actualQty === 0 ? "not_bought" : qtyGap > 0.0001 ? "over" : qtyGap < -0.0001 ? "under" : "equal";
    return { ...r, plannedQty, actualQty, plannedCost: round2(r.plannedCost), actualCost: round2(r.actualCost), qtyGap, qtyGapPercent: plannedQty ? Math.round((qtyGap / plannedQty) * 1000) / 10 : null, costGap: round2(r.actualCost - r.plannedCost), status };
  };
  const out = [...rows.values()].map((r) => finish(r, true)).sort((a, b) => b.costGap - a.costGap || a.label.localeCompare(b.label));
  const extra = [...unplanned.values()].map((r) => finish(r, false)).sort((a, b) => b.actualCost - a.actualCost);
  return {
    rows: out,
    unplanned: extra,
    plannedCost: round2(out.reduce((s, r) => s + r.plannedCost, 0)),
    actualCost: round2([...out, ...extra].reduce((s, r) => s + r.actualCost, 0)),
    overCount: out.filter((r) => r.status === "over").length + extra.length,
    underCount: out.filter((r) => r.status === "under").length,
  };
}

/** Suggestions pour associer une description achetée : matériaux du devis les plus proches. */
export function closestPlanned(key: string, plannedKeys: string[], n = 3) {
  return plannedKeys
    .map((k) => ({ key: k, score: similarity(key, k) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
