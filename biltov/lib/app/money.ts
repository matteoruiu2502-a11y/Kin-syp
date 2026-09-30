// Calculs de montants : HTVA par ligne, remises, options, récapitulatif par code de TVA, TVAC,
// acompte, déductions (facture finale), retenue de garantie, paiements.

import { vatRate, type VatCode } from "../tax/belgium";
import type { Doc, Line } from "./types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const countsInTotal = (l: Line) => l.kind === "item" && (!l.optional || l.selected);
export const lineTotal = (l: Line) => round2((l.qty || 0) * (l.unitPrice || 0) * (1 - (l.discountPercent || 0) / 100));

export type VatRow = { code: VatCode; rate: number; base: number; vat: number };
export type Totals = {
  gross: number; // somme des lignes HTVA avant remise globale
  discount: number;
  htva: number;
  vatRows: VatRow[];
  vat: number;
  tvac: number;
  deposit: number;
  retention: number;
  payable: number;
  paid: number;
  due: number;
  cost: number;
  margin: number;
};

const ORDER: VatCode[] = ["21", "12", "6", "0", "reverse", "exempt", "franchise"];

export function computeTotals(doc: Pick<Doc, "lines" | "globalDiscountPercent" | "depositPercent" | "deductions" | "retentionPercent" | "payments">): Totals {
  const items = doc.lines.filter(countsInTotal);
  const gross = round2(items.reduce((s, l) => s + lineTotal(l), 0));
  const factor = 1 - (doc.globalDiscountPercent || 0) / 100;
  const bases = new Map<VatCode, number>();
  for (const l of items) bases.set(l.vat, (bases.get(l.vat) ?? 0) + lineTotal(l) * factor);
  for (const d of doc.deductions ?? []) bases.set(d.vat, (bases.get(d.vat) ?? 0) - d.amount);
  const vatRows = [...bases.entries()]
    .map(([code, b]) => {
      const base = round2(b);
      return { code, rate: vatRate(code), base, vat: round2((base * vatRate(code)) / 100) };
    })
    .filter((r) => r.base !== 0)
    .sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
  const htva = round2(vatRows.reduce((s, r) => s + r.base, 0));
  const vat = round2(vatRows.reduce((s, r) => s + r.vat, 0));
  const tvac = round2(htva + vat);
  const retention = round2((tvac * (doc.retentionPercent || 0)) / 100);
  const payable = round2(tvac - retention);
  const paid = round2((doc.payments ?? []).reduce((s, p) => s + p.amount, 0));
  const cost = round2(items.reduce((s, l) => s + (l.costPrice || 0) * (l.qty || 0), 0));
  return {
    gross,
    discount: round2(gross - gross * factor),
    htva,
    vatRows,
    vat,
    tvac,
    deposit: round2((tvac * (doc.depositPercent || 0)) / 100),
    retention,
    payable,
    paid,
    due: round2(payable - paid),
    cost,
    margin: round2(htva - cost),
  };
}

const fmt = (locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
/** Montant pour les PDF (espaces simples : les polices PDF standard ignorent l'espace fine). */
export const eur = (n: number, locale = "fr-BE") => fmt(locale).format(n).replace(/[  ]/g, " ");
export const num = (n: number, digits = 2, locale = "fr-BE") => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n).replace(/[  ]/g, " ");
