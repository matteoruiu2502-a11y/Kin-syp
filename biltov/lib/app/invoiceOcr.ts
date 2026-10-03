// Analyse du texte OCR d'une facture fournisseur ou d'un bon de livraison belge :
// fournisseur, n° de document, dates, bases HTVA par taux (0/6/12/21 %), TVA, TVAC, IBAN, BCE, communication structurée.

import { isBce, isIban } from "../tax/belgium";
import { extractStructured } from "./bank";
import { round2 } from "./money";

export type VatRow = { rate: number; base: number; vat: number };
export type InvoiceGuess = {
  kind: "invoice" | "delivery";
  supplier: string;
  bce: string;
  number: string;
  date: string;
  dueDate: string;
  vatRows: VatRow[];
  totalHtva: number | null;
  totalVat: number | null;
  totalTvac: number | null;
  iban: string;
  structuredComm: string;
  confidence: number; // 0 à 1 : part des champs trouvés et cohérents
};

const AMOUNT_SRC = String.raw`-?\d{1,3}(?:[ . ]\d{3})*(?:[.,]\d{2})|-?\d+(?:[.,]\d{2})`;
const AMOUNT = new RegExp(AMOUNT_SRC, "g");

/** « 1.234,56 » / « 1 234.56 » / « 1234,56 » → 1234.56 */
export function parseAmount(raw: string): number {
  const s = raw.replace(/[\s ]/g, "");
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  const int = s.slice(0, lastSep).replace(/[.,]/g, "");
  return Number(`${int}.${s.slice(lastSep + 1)}`);
}

const amountsIn = (line: string) => [...line.matchAll(AMOUNT)].map((m) => parseAmount(m[0])).filter((n) => Number.isFinite(n));
const toIso = (d: string, m: string, y: string) => `${y.length === 2 ? `20${y}` : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
const DATE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;

function dateAfter(lines: string[], re: RegExp) {
  for (const l of lines) {
    if (!re.test(l)) continue;
    const m = l.match(DATE);
    if (m) return toIso(m[1], m[2], m[3]);
  }
  return "";
}

function lastAmountAfter(lines: string[], re: RegExp) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!re.test(lines[i])) continue;
    const a = amountsIn(lines[i]);
    if (a.length) return a[a.length - 1];
    const next = lines[i + 1] ? amountsIn(lines[i + 1]) : [];
    if (next.length) return next[next.length - 1];
  }
  return null;
}

export function guessInvoice(text: string): InvoiceGuess {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const joined = lines.join("\n");
  const kind: InvoiceGuess["kind"] = /bon de livraison|leveringsbon|lieferschein|delivery note|\bBL\b/i.test(joined) && !/\bfacture\b|\bfactuur\b|\brechnung\b/i.test(joined) ? "delivery" : "invoice";

  const numM = joined.match(/(?:facture|factuur|rechnung|invoice|bon de livraison|leveringsbon|lieferschein)\s*(?:n[°o]\.?|nr\.?|num[ée]ro|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,20})/i) ?? joined.match(/\b(?:n[°o]|nr)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,20})/i);
  const number = numM ? numM[1].replace(/[.:]+$/, "") : "";

  const date = dateAfter(lines, /date|datum/i) || (joined.match(DATE) ? toIso(...(joined.match(DATE)!.slice(1, 4) as [string, string, string])) : "");
  const dueDate = dateAfter(lines, /[ée]ch[ée]ance|vervaldag|f[äa]llig|due date|payable avant|te betalen voor/i);

  const ibanM = joined.replace(/(BE\d{2})[  ]?(\d{4})[  ]?(\d{4})[  ]?(\d{4})/g, "$1$2$3$4").match(/\bBE\d{14}\b/);
  const iban = ibanM && isIban(ibanM[0]) ? ibanM[0].replace(/(.{4})/g, "$1 ").trim() : "";

  const bceCandidates = [...joined.matchAll(/\b(?:BE\s?)?([01]\d{3}|\d{3})[.\s]?(\d{3})[.\s]?(\d{3})\b/g)].map((m) => `${m[1].padStart(4, "0")}${m[2]}${m[3]}`);
  const bce = bceCandidates.find((b) => isBce(b)) ?? "";

  // Lignes de TVA : « 21 % 1.000,00 210,00 » ou « TVA 6% sur 500,00 = 30,00 »
  const vatRows: VatRow[] = [];
  for (const l of lines) {
    const rm = l.match(/\b(0|6|12|21)[,.]?0*\s?%/);
    if (!rm) continue;
    const rate = Number(rm[1]);
    const nums = amountsIn(l.replace(rm[0], " ")).filter((n) => n > 0);
    if (!nums.length) continue;
    let row: VatRow | null = null;
    for (let i = 0; i < nums.length && !row; i++)
      for (let j = 0; j < nums.length && !row; j++) if (i !== j && Math.abs((nums[i] * rate) / 100 - nums[j]) <= 0.02) row = { rate, base: nums[i], vat: nums[j] };
    if (!row && rate === 0) row = { rate, base: nums[nums.length - 1], vat: 0 };
    if (row && !vatRows.some((r) => r.rate === row!.rate)) vatRows.push(row);
  }

  const totalTvac = lastAmountAfter(lines, /total\s*(?:tvac|ttc|[àa] payer)|tvac|incl\.?\s*(?:btw|tva)|te betalen|totaal|gesamtbetrag|brutto|net [àa] payer|montant total/i);
  let totalHtva = lastAmountAfter(lines, /htva|hors tva|excl\.?\s*(?:btw|tva)|total\s*ht|netto|maatstaf|base imposable/i);
  let totalVat = lastAmountAfter(lines, /^(?:total\s*)?(?:tva|btw|mwst)\b(?!.*%)/i);
  if (vatRows.length) {
    totalHtva ??= round2(vatRows.reduce((s, r) => s + r.base, 0));
    totalVat ??= round2(vatRows.reduce((s, r) => s + r.vat, 0));
  }
  if (!vatRows.length && totalHtva && totalTvac && totalTvac >= totalHtva) {
    const vat = round2(totalTvac - totalHtva);
    const rate = [21, 12, 6, 0].find((r) => Math.abs((totalHtva! * r) / 100 - vat) <= 0.05);
    if (rate !== undefined) vatRows.push({ rate, base: totalHtva, vat });
    totalVat ??= vat;
  }

  const supplier = (lines.find((l) => /[a-z]{3,}/i.test(l) && !/facture|factuur|rechnung|invoice|date|page|bon de/i.test(l)) ?? "").slice(0, 60);
  const consistent = totalHtva !== null && totalTvac !== null && totalVat !== null && Math.abs(totalHtva + totalVat - totalTvac) <= 0.05;
  const found = [supplier, number, date, iban || bce, totalTvac !== null ? "x" : "", vatRows.length ? "x" : ""].filter(Boolean).length;
  return { kind, supplier, bce, number, date, dueDate, vatRows, totalHtva, totalVat, totalTvac, iban, structuredComm: extractStructured(joined) ?? "", confidence: Math.min(1, found / 6 + (consistent ? 0.1 : 0)) };
}
