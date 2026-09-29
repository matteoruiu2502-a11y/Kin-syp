import type { Doc, Line, VatRate } from "./types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const lineTotal = (l: Line) => round2(l.qty * l.unitPrice);

export type Totals = {
  ht: number;
  vatByRate: { rate: VatRate; base: number; vat: number }[];
  vat: number;
  ttc: number;
  deposit: number; // acompte demandé (devis)
  due: number; // net à payer (factures, après acomptes)
};

/** Totaux conformes : total HT par ligne arrondi, TVA calculée par taux sur la base cumulée. */
export function computeTotals(doc: Pick<Doc, "lines" | "depositPercent" | "paidBefore">, vatApplies = true): Totals {
  const ht = round2(doc.lines.reduce((s, l) => s + lineTotal(l), 0));
  const bases = new Map<VatRate, number>();
  for (const l of doc.lines) {
    const rate = vatApplies ? l.vat : 0;
    bases.set(rate, round2((bases.get(rate) ?? 0) + lineTotal(l)));
  }
  const vatByRate = [...bases.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base, vat: round2((base * rate) / 100) }));
  const vat = round2(vatByRate.reduce((s, v) => s + v.vat, 0));
  const ttc = round2(ht + vat);
  return { ht, vatByRate, vat, ttc, deposit: round2((ttc * (doc.depositPercent || 0)) / 100), due: round2(ttc - (doc.paidBefore || 0)) };
}

/** Montant formaté pour les PDF (espaces simples : les polices PDF standard ignorent l'espace fine). */
export const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n).replace(/[  ]/g, " ");

export const num = (n: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(n).replace(/[  ]/g, " ");
