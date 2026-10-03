// Commandes fournisseurs : suivi (commandé → en préparation → livré sur chantier → vérifié)
// et rapprochement bon de commande / bon(s) de livraison / facture du grossiste.

import { round2 } from "./money";
import { uid } from "./defaults";
import type { AccountData, Purchase, PurchaseStatus } from "./types";

export const ORDER_FLOW: PurchaseStatus[] = ["draft", "ordered", "preparing", "delivered", "verified"];
export const nextOrderStatus = (s: PurchaseStatus): PurchaseStatus | null => {
  const i = ORDER_FLOW.indexOf(s);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
};
export const statusesFor = (type: Purchase["type"]): PurchaseStatus[] => (type === "order" ? ORDER_FLOW : type === "delivery" ? ["delivered", "verified"] : ["to_pay", "paid"]);

export type CompareRow = {
  key: string;
  label: string;
  ordered: number;
  delivered: number;
  invoiced: number;
  orderPrice: number;
  invoicePrice: number | null;
  issues: ("missing" | "extra" | "short" | "over" | "price")[];
};

const keyOf = (l: Purchase["lines"][number]) => l.articleId ?? l.label.trim().toLowerCase();

/** Compare les quantités et prix commandés, livrés et facturés pour un bon de commande. */
export function compareOrder(d: AccountData, orderId: string): CompareRow[] {
  const order = d.purchases.find((p) => p.id === orderId);
  if (!order) return [];
  const linked = d.purchases.filter((p) => p.orderId === orderId);
  const deliveries = linked.filter((p) => p.type === "delivery");
  const invoices = linked.filter((p) => p.type === "invoice");
  const rows = new Map<string, CompareRow>();
  const row = (l: Purchase["lines"][number]) => {
    const k = keyOf(l);
    if (!rows.has(k)) rows.set(k, { key: k, label: l.label, ordered: 0, delivered: 0, invoiced: 0, orderPrice: 0, invoicePrice: null, issues: [] });
    return rows.get(k)!;
  };
  for (const l of order.lines) {
    const r = row(l);
    r.ordered += l.qty;
    r.orderPrice = l.unitPrice;
  }
  for (const l of deliveries.flatMap((p) => p.lines)) row(l).delivered += l.qty;
  for (const l of invoices.flatMap((p) => p.lines)) {
    const r = row(l);
    r.invoiced += l.qty;
    r.invoicePrice = l.unitPrice;
  }
  const hasDelivery = deliveries.length > 0;
  const hasInvoice = invoices.length > 0;
  for (const r of rows.values()) {
    if (!r.ordered) r.issues.push("extra");
    else if (hasDelivery && r.delivered === 0) r.issues.push("missing");
    else if (hasDelivery && r.delivered < r.ordered) r.issues.push("short");
    else if (hasDelivery && r.delivered > r.ordered) r.issues.push("over");
    if (hasInvoice && r.invoiced > Math.max(r.delivered, hasDelivery ? 0 : r.ordered) + 1e-9) r.issues.push("over");
    if (r.invoicePrice !== null && r.ordered && Math.abs(r.invoicePrice - r.orderPrice) > 0.005) r.issues.push("price");
    r.issues = [...new Set(r.issues)];
  }
  return [...rows.values()];
}

/** Écart total en euros entre la facture et la commande (prix et quantités facturés). */
export const invoiceGap = (rows: CompareRow[]) => round2(rows.reduce((s, r) => s + r.invoiced * (r.invoicePrice ?? r.orderPrice) - r.invoiced * r.orderPrice, 0));

/** Devis signé → bons de commande fournisseurs (un par fournisseur des articles), numérotés BC-AAAA-NNNN. */
export function ordersFromQuote(d: AccountData, quoteId: string, fallbackSupplierId: string | null): [AccountData, Purchase[]] {
  const q = d.docs.find((x) => x.id === quoteId);
  if (!q) return [d, []];
  const groups = new Map<string, Purchase["lines"]>();
  for (const l of q.lines) {
    if (l.kind !== "item" || (l.optional && !l.selected) || !l.articleId) continue;
    const a = d.articles.find((x) => x.id === l.articleId);
    if (!a || a.type === "labour" || a.type === "subcontract") continue;
    const sid = a.supplierId ?? fallbackSupplierId;
    if (!sid) continue;
    // ouvrages composés : on commande les composants
    const parts = a.components.length ? a.components.map((c) => ({ art: d.articles.find((x) => x.id === c.articleId), qty: c.qty * l.qty })) : [{ art: a, qty: l.qty }];
    for (const { art, qty } of parts) {
      if (!art || art.type === "labour") continue;
      const key = art.supplierId ?? sid;
      const lines = groups.get(key) ?? [];
      const same = lines.find((x) => x.articleId === art.id);
      if (same) same.qty = round2(same.qty + qty);
      else lines.push({ id: uid(), articleId: art.id, label: art.name.fr, qty: round2(qty), unitPrice: art.purchasePrice, vat: 21 });
      groups.set(key, lines);
    }
  }
  let next = d;
  const created: Purchase[] = [];
  for (const [supplierId, lines] of groups) {
    const key = `${next.settings.prefixes.order}-${new Date().getFullYear()}`;
    const n = (next.settings.counters[key] ?? 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const p: Purchase = { id: uid(), type: "order", supplierId, jobId: q.jobId, number: `${key}-${String(n).padStart(4, "0")}`, date: today, dueDate: today, lines, status: "draft", source: "manual", retention: null, paidAt: null, fileId: null };
    next = { ...next, settings: { ...next.settings, counters: { ...next.settings.counters, [key]: n } }, purchases: [p, ...next.purchases] };
    created.push(p);
  }
  return [next, created];
}
