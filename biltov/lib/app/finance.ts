// Pilotage financier : argent à recevoir, prévision de trésorerie, estimation TVA, obligation de retenue, journaux comptables.
// Fonctions pures (testées) ; l'interface se contente de les afficher.

import { addDays, todayIso } from "./defaults";
import { computeTotals, round2 } from "./money";
import { jobFinance } from "./ops";
import { legal, legalInForce } from "../tax/belgium";
import type { AccountData, Doc, Purchase, RetentionCheck, VatCode } from "./types";

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5);

/** Factures émises dont il reste un montant à encaisser. */
export const openInvoices = (d: AccountData) => d.docs.filter((x) => x.type === "invoice" && x.lockedAt && (x.status === "issued" || x.status === "partial") && computeTotals(x).due > 0.005);

export type Bucket = "notDue" | "d30" | "d60" | "d60plus";
export const bucketOf = (dueDate: string, today = todayIso()): Bucket => {
  const late = days(dueDate, today);
  return late <= 0 ? "notDue" : late <= 30 ? "d30" : late <= 60 ? "d60" : "d60plus";
};

/** Encours clients par ancienneté (TVAC, montants restant dus). */
export function receivables(d: AccountData, today = todayIso()) {
  const buckets: Record<Bucket, number> = { notDue: 0, d30: 0, d60: 0, d60plus: 0 };
  const rows = openInvoices(d).map((doc) => {
    const t = computeTotals(doc);
    const b = bucketOf(doc.dueDate, today);
    buckets[b] += t.due;
    return { doc, due: t.due, paid: t.paid, bucket: b, late: Math.max(0, days(doc.dueDate, today)), disputed: doc.dispute?.active ?? false };
  });
  (Object.keys(buckets) as Bucket[]).forEach((k) => (buckets[k] = round2(buckets[k])));
  return { rows: rows.sort((a, b) => b.late - a.late), buckets, total: round2(rows.reduce((s, r) => s + r.due, 0)), partial: rows.filter((r) => r.paid > 0) };
}

/** Travaux signés pas encore facturés, par chantier (HTVA). */
export function toInvoiceByJob(d: AccountData) {
  return d.jobs
    .filter((j) => ["accepted", "in_progress", "done"].includes(j.status))
    .map((job) => ({ job, amount: jobFinance(d, job.id).toInvoice }))
    .filter((r) => r.amount > 0.005)
    .sort((a, b) => b.amount - a.amount);
}

/** Devis envoyés en attente de signature : total brut et pondéré par la probabilité. */
export function pendingQuotes(d: AccountData) {
  const jobs = d.jobs.filter((j) => j.status === "sent");
  return { count: jobs.length, gross: round2(jobs.reduce((s, j) => s + j.amount, 0)), weighted: round2(jobs.reduce((s, j) => s + (j.amount * j.probability) / 100, 0)) };
}

export type Period = "month" | "quarter" | "year";
const periodStart = (iso: string, p: Period) => {
  const [y, m] = iso.split("-").map(Number);
  const mm = p === "year" ? 1 : p === "quarter" ? Math.floor((m - 1) / 3) * 3 + 1 : m;
  return `${y}-${String(mm).padStart(2, "0")}-01`;
};
const shift = (start: string, p: Period, n: number) => {
  const [y, m] = start.split("-").map(Number);
  const step = p === "year" ? 12 : p === "quarter" ? 3 : 1;
  const idx = y * 12 + (m - 1) + step * n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`;
};
export const periodRange = (p: Period, today = todayIso(), offset = 0) => {
  const from = shift(periodStart(today, p), p, offset);
  return { from, to: shift(from, p, 1) }; // [from, to[
};

/** Encaissé (TVAC) sur la période en cours et la même période précédente. */
export function cashed(d: AccountData, p: Period, today = todayIso()) {
  const sum = (from: string, to: string) =>
    round2(d.docs.filter((x) => x.type === "invoice").reduce((s, x) => s + x.payments.filter((pm) => pm.date >= from && pm.date < to).reduce((a, pm) => a + pm.amount, 0), 0));
  const cur = periodRange(p, today);
  const prev = periodRange(p, today, -1);
  return { current: sum(cur.from, cur.to), previous: sum(prev.from, prev.to) };
}

/** Retenues de garantie détenues par les clients. */
export const retentionsHeld = (d: AccountData) => round2(d.docs.filter((x) => x.type === "invoice" && x.lockedAt && x.status !== "cancelled").reduce((s, x) => s + computeTotals(x).retention, 0));

export const purchaseTotals = (p: Purchase) => {
  const ht = round2(p.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const vat = round2(p.lines.reduce((s, l) => s + (l.qty * l.unitPrice * l.vat) / 100, 0));
  return { ht, vat, ttc: round2(ht + vat) };
};

/** Obligation de retenue (art. 30bis loi ONSS, art. 403 CIR) : montants à retenir et à verser directement aux administrations. */
export function retentionFor(amountHtva: number, check: RetentionCheck | null, date = todayIso()) {
  if (!check) return { onss: 0, tax: 0, inasti: 0, total: 0, toSupplier: amountHtva, checked: false };
  const onss = check.onssDebt ? round2((amountHtva * legal("retention.onssPercent", date)) / 100) : 0;
  const tax = check.taxDebt ? round2((amountHtva * legal("retention.taxPercent", date)) / 100) : 0;
  const inastiRate = legalInForce("retention.inastiPercent", date); // volet INASTI : null avant son entrée en vigueur
  const inasti = check.inastiDebt && inastiRate ? round2((amountHtva * inastiRate) / 100) : 0;
  const max = legalInForce("retention.maxPercent", date);
  const total = max === null ? round2(onss + tax + inasti) : Math.min(round2(onss + tax + inasti), round2((amountHtva * max) / 100));
  return { onss, tax, inasti, total, toSupplier: round2(amountHtva - total), checked: true };
}

/** Prévision de trésorerie hebdomadaire : entrées attendues (échéances clients) − sorties (fournisseurs à payer). */
export function cashForecast(d: AccountData, weeks = 13, today = todayIso(), opening = 0) {
  const rows = Array.from({ length: weeks }, (_, i) => ({ from: addDays(today, i * 7), to: addDays(today, i * 7 + 7), inflow: 0, outflow: 0, balance: 0 }));
  const slot = (date: string) => Math.max(0, Math.min(weeks - 1, Math.floor(days(today, date) / 7)));
  for (const r of receivables(d, today).rows) if (!r.disputed) rows[slot(r.doc.dueDate)].inflow += r.due;
  for (const p of d.purchases) if (p.type === "invoice" && p.status !== "paid") rows[slot(p.dueDate)].outflow += purchaseTotals(p).ttc;
  let bal = opening;
  for (const r of rows) {
    r.inflow = round2(r.inflow);
    r.outflow = round2(r.outflow);
    bal = round2(bal + r.inflow - r.outflow);
    r.balance = bal;
  }
  return rows;
}

// ——— Aide TVA : grilles de la déclaration périodique ——————————————————————————————
// Estimation à titre d'aide ; la déclaration reste à valider par le comptable.

export const SALES_GRID: Record<VatCode, string | null> = { "0": "00", exempt: "00", "6": "01", "12": "02", "21": "03", reverse: "45", franchise: null };

export type VatGrids = Record<string, number>;

export function vatGrids(d: AccountData, from: string, to: string): { grids: VatGrids; toPay: number; notes: string[] } {
  const g: VatGrids = {};
  const add = (k: string, v: number) => (g[k] = round2((g[k] ?? 0) + v));
  const notes: string[] = [];
  const inPeriod = (x: Doc) => x.lockedAt && x.issueDate >= from && x.issueDate < to;
  for (const doc of d.docs.filter((x) => (x.type === "invoice" || x.type === "credit") && inPeriod(x))) {
    const t = computeTotals(doc);
    for (const r of t.vatRows) {
      const grid = SALES_GRID[r.code];
      if (!grid) continue;
      if (doc.type === "invoice") {
        add(grid, r.base);
        if (r.vat) add("54", r.vat);
      } else {
        add("49", r.base);
        if (r.vat) add("64", r.vat);
      }
    }
  }
  for (const p of d.purchases.filter((x) => x.type === "invoice" && x.date >= from && x.date < to)) {
    const sub = d.suppliers.find((s) => s.id === p.supplierId)?.kind === "subcontractor";
    for (const l of p.lines) {
      const base = l.qty * l.unitPrice;
      if (sub && l.vat === 0) {
        // autoliquidation : TVA due par Biltov-utilisateur et déductible en même temps
        add("87", base);
        add("56", (base * 21) / 100);
        add("59", (base * 21) / 100);
        continue;
      }
      add(sub ? "82" : "81", base);
      add("59", (base * l.vat) / 100);
    }
  }
  for (const e of d.expenses.filter((x) => x.date >= from && x.date < to)) {
    const ht = e.amountTTC / (1 + e.vat / 100);
    add("82", ht);
    add("59", e.amountTTC - ht);
  }
  if (g["87"]) notes.push("Autoliquidation sous-traitance : taux de 21 % supposé (6 % si logement privé de plus de 10 ans).");
  notes.push("Grille 81/82 : la répartition marchandises / services est approximative. Les biens d'investissement (grille 83) ne sont pas détectés.");
  const due = (g["54"] ?? 0) + (g["56"] ?? 0) + (g["57"] ?? 0) + (g["61"] ?? 0) + (g["63"] ?? 0);
  const ded = (g["59"] ?? 0) + (g["62"] ?? 0) + (g["64"] ?? 0);
  Object.keys(g).forEach((k) => (g[k] = round2(g[k])));
  return { grids: g, toPay: round2(due - ded), notes };
}

// ——— Journaux comptables ————————————————————————————————————————————————————

export function salesJournal(d: AccountData, from: string, to: string) {
  const headers = ["Journal", "Date", "Numéro", "Type", "Client", "N° entreprise / TVA", "Base 21 %", "Base 12 %", "Base 6 %", "Base 0 % / exonéré", "Base autoliquidation", "TVA", "Total TVAC", "Échéance", "Communication structurée", "Statut", "Chantier"];
  const rows = d.docs
    .filter((x) => (x.type === "invoice" || x.type === "credit") && x.lockedAt && x.issueDate >= from && x.issueDate < to)
    .sort((a, b) => (a.number ?? "").localeCompare(b.number ?? ""))
    .map((x) => {
      const t = computeTotals(x);
      const sign = x.type === "credit" ? -1 : 1;
      const base = (codes: VatCode[]) => round2(sign * t.vatRows.filter((r) => codes.includes(r.code)).reduce((s, r) => s + r.base, 0));
      const c = d.clients.find((cl) => cl.id === x.clientId);
      return ["VEN", x.issueDate, x.number ?? "", x.type === "credit" ? "Note de crédit" : "Facture", c?.name ?? "", c?.vatNumber || c?.bce || "", base(["21"]), base(["12"]), base(["6"]), base(["0", "exempt", "franchise"]), base(["reverse"]), round2(sign * t.vat), round2(sign * t.tvac), x.dueDate, x.structuredComm, x.status, d.jobs.find((j) => j.id === x.jobId)?.name ?? ""];
    });
  return { headers, rows };
}

export function purchaseJournal(d: AccountData, from: string, to: string) {
  const headers = ["Journal", "Date", "Numéro", "Fournisseur", "N° entreprise", "HTVA", "TVA", "TVAC", "Échéance", "Statut", "Chantier", "Retenue ONSS/SPF"];
  const rows: (string | number)[][] = d.purchases
    .filter((p) => p.type === "invoice" && p.date >= from && p.date < to)
    .map((p) => {
      const s = d.suppliers.find((x) => x.id === p.supplierId);
      const t = purchaseTotals(p);
      return ["ACH", p.date, p.number, s?.name ?? "", s?.bce ?? "", t.ht, t.vat, t.ttc, p.dueDate, p.status, d.jobs.find((j) => j.id === p.jobId)?.name ?? "", retentionFor(t.ht, p.retention, p.date).total];
    });
  for (const e of d.expenses.filter((x) => x.date >= from && x.date < to)) {
    const ht = round2(e.amountTTC / (1 + e.vat / 100));
    rows.push(["FRA", e.date, "", e.supplier, "", ht, round2(e.amountTTC - ht), e.amountTTC, "", e.status, d.jobs.find((j) => j.id === e.jobId)?.name ?? "", 0]);
  }
  return { headers, rows: rows.sort((a, b) => String(a[1]).localeCompare(String(b[1]))) };
}

export function paymentsJournal(d: AccountData, from: string, to: string) {
  const headers = ["Date", "Facture", "Client", "Montant", "Moyen", "Référence"];
  const rows = d.docs.flatMap((x) =>
    x.payments.filter((p) => p.date >= from && p.date < to).map((p) => [p.date, x.number ?? "", d.clients.find((c) => c.id === x.clientId)?.name ?? "", p.amount, p.method, p.reference] as (string | number)[]),
  );
  return { headers, rows: rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]))) };
}

export const toCsv = (headers: string[], rows: (string | number)[][]) =>
  "﻿" + [headers, ...rows].map((r) => r.map((v) => (typeof v === "number" ? String(v).replace(".", ",") : `"${String(v).replace(/"/g, '""')}"`)).join(";")).join("\r\n");
