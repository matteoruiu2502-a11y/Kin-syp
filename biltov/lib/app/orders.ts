// Commandes fournisseurs : suivi (commandé → en préparation → livré sur chantier → vérifié)
// et rapprochement bon de commande / bon(s) de livraison / facture du grossiste.

import { round2 } from "./money";
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
