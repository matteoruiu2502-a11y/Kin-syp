// Exécution ligne par ligne : chaque ligne de devis est réalisée par notre société (nos ouvriers)
// ou par un sous-traitant, avec sa propre marge sur le prix de revient (PU = coût × (1 + marge %)).
// La rentabilité du chantier est ensuite ventilée entre « réalisé par nous » et chaque sous-traitant.

import { countsInTotal, lineTotal, round2 } from "./money";
import { purchaseTotals } from "./finance";
import type { AccountData, Line, Settings, Supplier } from "./types";

export const OWN = "own";

/** Prix de vente unitaire à partir du coût et de la marge. */
export const priceFromCost = (cost: number, marginPercent: number) => round2((cost || 0) * (1 + (marginPercent || 0) / 100));

/** Marge de la ligne (%) : celle choisie, sinon déduite du prix et du coût ; null si pas de coût. */
export function lineMargin(l: Pick<Line, "costPrice" | "unitPrice" | "marginPercent">): number | null {
  if (l.marginPercent !== undefined && l.marginPercent !== null) return l.marginPercent;
  if (!l.costPrice) return null;
  return Math.round(((l.unitPrice || 0) / l.costPrice - 1) * 1000) / 10;
}

/** Marge par défaut selon l'exécutant (fiche du sous-traitant, sinon réglage général). */
export function defaultMargin(settings: Pick<Settings, "defaultMargins">, suppliers: Supplier[], executedBy: string | null | undefined) {
  const m = settings.defaultMargins ?? { own: 30, subcontract: 15 };
  if (!executedBy) return m.own;
  return suppliers.find((s) => s.id === executedBy)?.marginPercent ?? m.subcontract;
}

/** Change l'exécutant : la marge par défaut de l'exécutant s'applique et le prix est recalculé (si un coût existe). */
export function withExecution(d: Pick<AccountData, "settings" | "suppliers">, l: Line, executedBy: string | null): Line {
  const margin = defaultMargin(d.settings, d.suppliers, executedBy);
  return { ...l, executedBy, marginPercent: margin, ...(l.costPrice ? { unitPrice: priceFromCost(l.costPrice, margin), toPrice: false } : {}) };
}

/** Change le coût en gardant la marge de la ligne. */
export function withCost(d: Pick<AccountData, "settings" | "suppliers">, l: Line, cost: number): Line {
  const margin = lineMargin(l) ?? defaultMargin(d.settings, d.suppliers, l.executedBy);
  return { ...l, costPrice: cost, marginPercent: margin, unitPrice: priceFromCost(cost, margin), toPrice: false };
}

/** Change la marge : nouveau prix de vente. */
export const withMargin = (l: Line, margin: number): Line => ({ ...l, marginPercent: margin, ...(l.costPrice ? { unitPrice: priceFromCost(l.costPrice, margin), toPrice: false } : {}) });

/** Prix saisi à la main : la marge suit. */
export const withPrice = (l: Line, price: number): Line => ({ ...l, unitPrice: price, toPrice: false, marginPercent: l.costPrice ? Math.round((price / l.costPrice - 1) * 1000) / 10 : (l.marginPercent ?? null) });

// ── Rentabilité par exécutant ───────────────────────────────────────────────

export type ExecutionRow = {
  key: string; // « own » ou id du sous-traitant
  name: string;
  lines: number;
  revenue: number; // chiffre d'affaires HTVA (lignes vendues, remise globale comprise)
  plannedCost: number;
  actualCost: number; // réel : factures, heures, dépenses… (+ engagé non facturé)
  plannedMargin: number;
  plannedMarginRate: number;
  actualMargin: number;
  actualMarginRate: number;
};

export type ExecutionBreakdown = { own: ExecutionRow; subcontractors: ExecutionRow[]; subTotal: ExecutionRow; total: ExecutionRow };

const rate = (m: number, base: number) => (base ? Math.round((m / base) * 1000) / 10 : 0);

function row(key: string, name: string, lines: number, revenue: number, plannedCost: number, actualCost: number): ExecutionRow {
  revenue = round2(revenue);
  plannedCost = round2(plannedCost);
  actualCost = round2(actualCost);
  return { key, name, lines, revenue, plannedCost, actualCost, plannedMargin: round2(revenue - plannedCost), plannedMarginRate: rate(revenue - plannedCost, revenue), actualMargin: round2(revenue - actualCost), actualMarginRate: rate(revenue - actualCost, revenue) };
}

const sumRows = (key: string, name: string, rows: ExecutionRow[]) =>
  row(
    key,
    name,
    rows.reduce((s, r) => s + r.lines, 0),
    rows.reduce((s, r) => s + r.revenue, 0),
    rows.reduce((s, r) => s + r.plannedCost, 0),
    rows.reduce((s, r) => s + r.actualCost, 0),
  );

/**
 * Ventile le chantier entre notre société et chaque sous-traitant.
 * Vendu : lignes des devis signés (avenants compris), remise globale répartie au prorata.
 * Réel sous-traitant : ses factures (et bons livrés non encore facturés) imputées au chantier.
 * Réel notre société : matériaux (fournisseurs), dépenses, sorties de stock, heures, véhicules et locations.
 */
export function executionBreakdown(d: AccountData, jobId: string): ExecutionBreakdown {
  const isSub = (id: string | null | undefined) => !!id && d.suppliers.some((s) => s.id === id && s.kind === "subcontractor");
  const signed = d.docs.filter((x) => x.jobId === jobId && x.type === "quote" && x.status === "accepted");
  const acc = new Map<string, { lines: number; revenue: number; planned: number; actual: number }>();
  const get = (k: string) => acc.get(k) ?? (acc.set(k, { lines: 0, revenue: 0, planned: 0, actual: 0 }), acc.get(k)!);

  for (const q of signed) {
    const factor = 1 - (q.globalDiscountPercent || 0) / 100;
    for (const l of q.lines.filter(countsInTotal)) {
      const g = get(isSub(l.executedBy) ? l.executedBy! : OWN);
      g.lines += 1;
      g.revenue += lineTotal(l) * factor;
      g.planned += (l.costPrice || 0) * (l.qty || 0);
    }
  }

  const purchases = d.purchases.filter((p) => p.jobId === jobId);
  const invoicedOrders = new Set(purchases.filter((p) => p.type === "invoice" && p.orderId).map((p) => p.orderId));
  for (const p of purchases) {
    const counts = p.type === "invoice" || (p.type === "order" && ["delivered", "verified", "received"].includes(p.status) && !invoicedOrders.has(p.id));
    if (!counts) continue;
    get(isSub(p.supplierId) ? p.supplierId : OWN).actual += purchaseTotals(p).ht;
  }
  const own = get(OWN);
  own.actual += d.expenses.filter((x) => x.jobId === jobId).reduce((s, e) => s + e.amountTTC / (1 + e.vat / 100), 0);
  own.actual += d.stockMoves.filter((x) => x.jobId === jobId && x.qty < 0).reduce((s, m) => s + -m.qty * (d.articles.find((a) => a.id === m.articleId)?.purchasePrice ?? 0), 0);
  own.actual += d.timeEntries.filter((x) => x.jobId === jobId).reduce((s, x) => s + x.hours * (d.members.find((m) => m.id === x.memberId)?.hourlyCost ?? 0), 0);
  own.actual += d.vehicles.flatMap((v) => v.costs).filter((c) => c.jobId === jobId).reduce((s, c) => s + c.amount, 0);
  own.actual += d.records.filter((r) => r.module === "rentals" && r.jobId === jobId && r.fields.billTo !== "client").reduce((s, r) => s + Number(r.fields.cost ?? 0), 0);

  const ownRow = row(OWN, "Notre société", own.lines, own.revenue, own.planned, own.actual);
  const subs = [...acc.entries()]
    .filter(([k]) => k !== OWN)
    .map(([k, v]) => row(k, d.suppliers.find((s) => s.id === k)?.name ?? "Sous-traitant supprimé", v.lines, v.revenue, v.planned, v.actual))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
  const subTotal = sumRows("subcontracting", "Sous-traitance", subs);
  return { own: ownRow, subcontractors: subs, subTotal, total: sumRows("total", "Total chantier", [ownRow, subTotal]) };
}

/** Somme vendue d'un devis par exécutant (aperçu dans l'éditeur). */
export function quoteByExecution(lines: Line[], globalDiscountPercent: number) {
  const factor = 1 - (globalDiscountPercent || 0) / 100;
  const out = new Map<string, { revenue: number; cost: number }>();
  for (const l of lines.filter(countsInTotal)) {
    const k = l.executedBy || OWN;
    const g = out.get(k) ?? { revenue: 0, cost: 0 };
    g.revenue += lineTotal(l) * factor;
    g.cost += (l.costPrice || 0) * (l.qty || 0);
    out.set(k, g);
  }
  return [...out.entries()].map(([key, v]) => ({ key, revenue: round2(v.revenue), cost: round2(v.cost), margin: round2(v.revenue - v.cost) }));
}

/** Où un sous-traitant est utilisé (avant suppression). */
export function subcontractorUsage(d: AccountData, supplierId: string) {
  return {
    lines: d.docs.reduce((s, x) => s + x.lines.filter((l) => l.executedBy === supplierId).length, 0),
    docs: d.docs.filter((x) => x.lines.some((l) => l.executedBy === supplierId)).length,
    purchases: d.purchases.filter((p) => p.supplierId === supplierId).length,
  };
}

