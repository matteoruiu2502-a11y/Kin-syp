// Rentabilité d'un chantier en temps réel : vendu (devis + avenants), facturé, coûts réels par poste
// (matières, main-d'œuvre, sous-traitance, matériel) et marge réelle comparée à la marge prévue.

import { computeTotals, countsInTotal, round2 } from "./money";
import { purchaseTotals } from "./finance";
import type { AccountData } from "./types";

export type CostPost = "materials" | "labour" | "subcontracting" | "equipment";
export type ProfitRow = { post: CostPost; planned: number; actual: number; committed: number };

export type JobProfit = {
  soldBase: number; // devis signés (hors avenants), HTVA
  amendments: number; // avenants signés
  sold: number;
  invoiced: number;
  cashed: number;
  rows: ProfitRow[];
  plannedCost: number;
  actualCost: number;
  committedCost: number; // commandes livrées non encore facturées par le fournisseur
  hours: number;
  plannedMargin: number;
  plannedMarginRate: number;
  actualMargin: number; // vendu − coûts réels (+ engagés)
  actualMarginRate: number;
  invoicedProgress: number; // % du vendu déjà facturé
  costProgress: number; // % des coûts prévus déjà consommés
};

const rate = (m: number, base: number) => (base ? Math.round((m / base) * 1000) / 10 : 0);

export function jobProfit(d: AccountData, jobId: string): JobProfit {
  const docs = d.docs.filter((x) => x.jobId === jobId);
  const signed = docs.filter((x) => x.type === "quote" && x.status === "accepted");
  const soldBase = round2(signed.filter((q) => !q.isAmendment).reduce((s, q) => s + computeTotals(q).htva, 0));
  const amendments = round2(signed.filter((q) => q.isAmendment).reduce((s, q) => s + computeTotals(q).htva, 0));
  const invoices = docs.filter((x) => x.type === "invoice" && x.lockedAt && x.status !== "cancelled");
  const credits = docs.filter((x) => x.type === "credit" && x.lockedAt);
  const invoiced = round2(invoices.reduce((s, x) => s + computeTotals(x).htva, 0) - credits.reduce((s, x) => s + computeTotals(x).htva, 0));
  const cashed = round2(invoices.reduce((s, x) => s + computeTotals(x).paid, 0));

  // Prévu : prix de revient des lignes des devis signés, réparti par poste
  const planned: Record<CostPost, number> = { materials: 0, labour: 0, subcontracting: 0, equipment: 0 };
  for (const q of signed)
    for (const l of q.lines.filter(countsInTotal)) {
      const art = l.articleId ? d.articles.find((a) => a.id === l.articleId) : undefined;
      const subLine = !!l.executedBy && d.suppliers.some((s) => s.id === l.executedBy && s.kind === "subcontractor");
      const post: CostPost = subLine || art?.type === "subcontract" ? "subcontracting" : art?.type === "equipment" ? "equipment" : l.category === "labour" || art?.type === "labour" ? "labour" : "materials";
      planned[post] += (l.costPrice || 0) * (l.qty || 0);
    }

  // Réel
  const actual: Record<CostPost, number> = { materials: 0, labour: 0, subcontracting: 0, equipment: 0 };
  const committed: Record<CostPost, number> = { materials: 0, labour: 0, subcontracting: 0, equipment: 0 };
  const sub = (supplierId: string) => d.suppliers.find((s) => s.id === supplierId)?.kind === "subcontractor";
  const jobPurchases = d.purchases.filter((p) => p.jobId === jobId);
  for (const p of jobPurchases.filter((x) => x.type === "invoice")) actual[sub(p.supplierId) ? "subcontracting" : "materials"] += purchaseTotals(p).ht;
  const invoicedOrders = new Set(jobPurchases.filter((x) => x.type === "invoice" && x.orderId).map((x) => x.orderId));
  for (const o of jobPurchases.filter((x) => x.type === "order" && ["delivered", "verified", "received"].includes(x.status) && !invoicedOrders.has(x.id)))
    committed[sub(o.supplierId) ? "subcontracting" : "materials"] += purchaseTotals(o).ht;
  for (const e of d.expenses.filter((x) => x.jobId === jobId)) actual.materials += e.amountTTC / (1 + e.vat / 100);
  for (const m of d.stockMoves.filter((x) => x.jobId === jobId && x.qty < 0)) actual.materials += -m.qty * (d.articles.find((a) => a.id === m.articleId)?.purchasePrice ?? 0);
  const entries = d.timeEntries.filter((x) => x.jobId === jobId);
  const hours = round2(entries.reduce((s, x) => s + x.hours, 0));
  actual.labour = entries.reduce((s, x) => s + x.hours * (d.members.find((m) => m.id === x.memberId)?.hourlyCost ?? 0), 0);
  actual.equipment += d.vehicles.flatMap((v) => v.costs).filter((c) => c.jobId === jobId).reduce((s, c) => s + c.amount, 0);
  actual.equipment += d.records.filter((r) => r.module === "rentals" && r.jobId === jobId && r.fields.billTo !== "client").reduce((s, r) => s + Number(r.fields.cost ?? 0), 0);

  const posts: CostPost[] = ["materials", "labour", "subcontracting", "equipment"];
  const rows = posts.map((post) => ({ post, planned: round2(planned[post]), actual: round2(actual[post]), committed: round2(committed[post]) }));
  const plannedCost = round2(rows.reduce((s, r) => s + r.planned, 0));
  const actualCost = round2(rows.reduce((s, r) => s + r.actual, 0));
  const committedCost = round2(rows.reduce((s, r) => s + r.committed, 0));
  const sold = round2(soldBase + amendments);
  const revenue = Math.max(sold, invoiced);
  const plannedMargin = round2(sold - plannedCost);
  const actualMargin = round2(revenue - actualCost - committedCost);
  return {
    soldBase,
    amendments,
    sold,
    invoiced,
    cashed,
    rows,
    plannedCost,
    actualCost,
    committedCost,
    hours,
    plannedMargin,
    plannedMarginRate: rate(plannedMargin, sold),
    actualMargin,
    actualMarginRate: rate(actualMargin, revenue),
    invoicedProgress: rate(invoiced, sold),
    costProgress: rate(actualCost + committedCost, plannedCost),
  };
}
