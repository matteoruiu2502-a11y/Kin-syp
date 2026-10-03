// Comptabilité : écritures en partie double (PCMN belge) des journaux de ventes et d'achats,
// exports CSV, WinBooks (DBF dBASE III) et UBL (Peppol BIS 3.0) pour Yuki, Pennylane, Odoo, BOB50…

import { computeTotals, round2 } from "./money";
import { purchaseTotals, retentionFor } from "./finance";
import type { AccountData, AccountingSettings, Client, Doc, Purchase, Supplier, VatCode } from "./types";

export type EntryLine = { account: string; label: string; debit: number; credit: number; vatCode: string; vatBase: number };
export type JournalEntry = {
  journal: string;
  kind: "sale" | "credit" | "purchase" | "expense";
  number: string;
  date: string;
  dueDate: string;
  partner: { code: string; name: string; vat: string };
  lines: EntryLine[];
  sourceId: string;
};

const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Codes tiers stables (ex. « DURAND01 ») : 6 lettres du nom + numéro d'ordre. */
export function partnerCodes<T extends { id: string; name: string }>(list: T[], prefix = "") {
  const out = new Map<string, string>();
  const used = new Map<string, number>();
  for (const x of list) {
    const stem = (prefix + clean(x.name)).slice(0, 6).padEnd(3, "X");
    const n = (used.get(stem) ?? 0) + 1;
    used.set(stem, n);
    out.set(x.id, `${stem}${String(n).padStart(2, "0")}`);
  }
  return out;
}

const VAT_LABEL: Record<VatCode, string> = { "21": "21", "12": "12", "6": "6", "0": "0", exempt: "EX", reverse: "AUTO", franchise: "FR" };
const vatNumberOf = (c: Client | Supplier | undefined) => (c ? ("vatNumber" in c && c.vatNumber ? c.vatNumber : c.bce ? `BE${c.bce.replace(/\D/g, "")}` : "") : "");

function saleEntry(d: AccountData, doc: Doc, a: AccountingSettings, codes: Map<string, string>): JournalEntry {
  const t = computeTotals(doc);
  const credit = doc.type === "credit";
  const c = d.clients.find((x) => x.id === doc.clientId);
  const side = (amount: number, debitSide: boolean) => (debitSide !== credit ? { debit: round2(amount), credit: 0 } : { debit: 0, credit: round2(amount) });
  const lines: EntryLine[] = [{ account: a.customers, label: c?.name ?? "", ...side(t.tvac, true), vatCode: "", vatBase: 0 }];
  for (const r of t.vatRows) lines.push({ account: a.sales, label: `Ventes ${VAT_LABEL[r.code]}`, ...side(r.base, false), vatCode: VAT_LABEL[r.code], vatBase: r.base });
  if (t.vat) lines.push({ account: a.vatDue, label: "TVA due", ...side(t.vat, false), vatCode: "", vatBase: 0 });
  return { journal: a.salesJournal, kind: credit ? "credit" : "sale", number: doc.number ?? "", date: doc.issueDate, dueDate: doc.dueDate, partner: { code: codes.get(doc.clientId) ?? "", name: c?.name ?? "", vat: vatNumberOf(c) }, lines, sourceId: doc.id };
}

function purchaseEntry(d: AccountData, p: Purchase, a: AccountingSettings, codes: Map<string, string>): JournalEntry {
  const s = d.suppliers.find((x) => x.id === p.supplierId);
  const sub = s?.kind === "subcontractor";
  const tot = purchaseTotals(p);
  const lines: EntryLine[] = [];
  const byRate = new Map<number, number>();
  for (const l of p.lines) byRate.set(l.vat, (byRate.get(l.vat) ?? 0) + l.qty * l.unitPrice);
  for (const [rate, base] of byRate) lines.push({ account: sub ? a.subcontracting : a.purchases, label: `Achats ${rate} %`, debit: round2(base), credit: 0, vatCode: String(rate), vatBase: round2(base) });
  if (tot.vat) lines.push({ account: a.vatDeductible, label: "TVA déductible", debit: tot.vat, credit: 0, vatCode: "", vatBase: 0 });
  if (sub && byRate.has(0)) {
    // autoliquidation : TVA à la fois due et déductible (21 % par défaut, à vérifier pour les logements de plus de 10 ans)
    const auto = round2(((byRate.get(0) ?? 0) * 21) / 100);
    lines.push({ account: a.vatDeductible, label: "TVA autoliquidée déductible", debit: auto, credit: 0, vatCode: "AUTO", vatBase: 0 });
    lines.push({ account: a.vatDue, label: "TVA autoliquidée due", debit: 0, credit: auto, vatCode: "AUTO", vatBase: 0 });
  }
  lines.push({ account: a.suppliers, label: s?.name ?? "", debit: 0, credit: tot.ttc, vatCode: "", vatBase: 0 });
  return { journal: a.purchasesJournal, kind: "purchase", number: p.number, date: p.date, dueDate: p.dueDate, partner: { code: codes.get(p.supplierId) ?? "", name: s?.name ?? "", vat: vatNumberOf(s) }, lines, sourceId: p.id };
}

/** Écritures de la période [from, to[ : ventes (factures et notes de crédit émises), achats et notes de frais. */
export function journalEntries(d: AccountData, from: string, to: string): JournalEntry[] {
  const a = d.settings.accounting;
  const clientCodes = partnerCodes(d.clients);
  const supplierCodes = partnerCodes(d.suppliers);
  const sales = d.docs
    .filter((x) => (x.type === "invoice" || x.type === "credit") && x.lockedAt && x.issueDate >= from && x.issueDate < to)
    .sort((x, y) => (x.number ?? "").localeCompare(y.number ?? ""))
    .map((x) => saleEntry(d, x, a, clientCodes));
  const purchases = d.purchases.filter((p) => p.type === "invoice" && p.date >= from && p.date < to).map((p) => purchaseEntry(d, p, a, supplierCodes));
  const expenses = d.expenses
    .filter((e) => e.date >= from && e.date < to)
    .map((e): JournalEntry => {
      const ht = round2(e.amountTTC / (1 + e.vat / 100));
      return {
        journal: a.purchasesJournal,
        kind: "expense",
        number: `NF-${e.id.slice(0, 6)}`,
        date: e.date,
        dueDate: e.date,
        partner: { code: "DIVERS", name: e.supplier || "Divers", vat: "" },
        lines: [
          { account: a.generalExpenses, label: e.label, debit: ht, credit: 0, vatCode: String(e.vat), vatBase: ht },
          ...(e.amountTTC - ht > 0.005 ? [{ account: a.vatDeductible, label: "TVA déductible", debit: round2(e.amountTTC - ht), credit: 0, vatCode: "", vatBase: 0 }] : []),
          { account: a.suppliers, label: e.supplier || "Divers", debit: 0, credit: e.amountTTC, vatCode: "", vatBase: 0 },
        ],
        sourceId: e.id,
      };
    });
  return [...sales, ...purchases, ...expenses.sort((x, y) => x.date.localeCompare(y.date))];
}

export const isBalanced = (e: JournalEntry) => Math.abs(e.lines.reduce((s, l) => s + l.debit - l.credit, 0)) < 0.011;

export function entriesCsv(entries: JournalEntry[]) {
  const head = ["Journal", "N° pièce", "Date", "Échéance", "Code tiers", "Tiers", "N° TVA", "Compte", "Libellé", "Débit", "Crédit", "Code TVA", "Base TVA"];
  const rows = entries.flatMap((e) => e.lines.map((l) => [e.journal, e.number, e.date, e.dueDate, e.partner.code, e.partner.name, e.partner.vat, l.account, l.label, l.debit, l.credit, l.vatCode, l.vatBase] as (string | number)[]));
  return { headers: head, rows };
}

// ——— DBF (dBASE III) ——————————————————————————————————————————————————————
export type DbfField = { name: string; type: "C" | "N" | "D" | "L"; length: number; decimals?: number };
type DbfValue = string | number | boolean | null | undefined;

/** Écrit une table dBASE III (format lu par WinBooks et la plupart des logiciels comptables belges). */
export function writeDbf(fields: DbfField[], records: Record<string, DbfValue>[], date = new Date()): Uint8Array {
  const headerLen = 32 + fields.length * 32 + 1;
  const recordLen = 1 + fields.reduce((s, f) => s + f.length, 0);
  const buf = new Uint8Array(headerLen + recordLen * records.length + 1);
  const view = new DataView(buf.buffer);
  buf[0] = 0x03;
  buf[1] = date.getFullYear() - 1900;
  buf[2] = date.getMonth() + 1;
  buf[3] = date.getDate();
  view.setUint32(4, records.length, true);
  view.setUint16(8, headerLen, true);
  view.setUint16(10, recordLen, true);
  fields.forEach((f, i) => {
    const o = 32 + i * 32;
    for (let k = 0; k < Math.min(10, f.name.length); k++) buf[o + k] = f.name.charCodeAt(k);
    buf[o + 11] = f.type.charCodeAt(0);
    buf[o + 16] = f.length;
    buf[o + 17] = f.decimals ?? 0;
  });
  buf[headerLen - 1] = 0x0d;
  const enc = (s: string) => Array.from(s.normalize("NFC"), (ch) => (ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 0x3f)); // Latin-1
  records.forEach((r, i) => {
    let o = headerLen + i * recordLen;
    buf[o++] = 0x20;
    for (const f of fields) {
      const v = r[f.name];
      let s: string;
      if (f.type === "N") s = v === null || v === undefined || v === "" ? "" : Number(v).toFixed(f.decimals ?? 0);
      else if (f.type === "D") s = typeof v === "string" ? v.replace(/-/g, "").slice(0, 8) : "";
      else if (f.type === "L") s = v === true ? "T" : v === false ? "F" : "?";
      else s = v === null || v === undefined ? "" : String(v);
      const bytes = enc(f.type === "N" ? s.padStart(f.length, " ").slice(-f.length) : s.padEnd(f.length, " ").slice(0, f.length));
      buf.set(bytes.slice(0, f.length), o);
      o += f.length;
    }
  });
  buf[buf.length - 1] = 0x1a;
  return buf;
}

// ——— WinBooks : ACT (écritures) et CSF (clients / fournisseurs) ————————————————————
// Structure de l'import WinBooks « ACT / CSF ». À valider par un import test avec votre comptable.
export const ACT_FIELDS: DbfField[] = [
  { name: "DBKCODE", type: "C", length: 6 },
  { name: "DBKTYPE", type: "N", length: 1 },
  { name: "DOCNUMBER", type: "C", length: 8 },
  { name: "DOCORDER", type: "C", length: 3 },
  { name: "OPCODE", type: "C", length: 5 },
  { name: "ACCOUNTGL", type: "C", length: 8 },
  { name: "ACCOUNTRP", type: "C", length: 10 },
  { name: "BOOKYEAR", type: "C", length: 1 },
  { name: "PERIOD", type: "C", length: 2 },
  { name: "DATE", type: "D", length: 8 },
  { name: "DATEDOC", type: "D", length: 8 },
  { name: "DUEDATE", type: "D", length: 8 },
  { name: "COMMENT", type: "C", length: 40 },
  { name: "COMMENTEXT", type: "C", length: 35 },
  { name: "AMOUNT", type: "N", length: 17, decimals: 3 },
  { name: "AMOUNTEUR", type: "N", length: 17, decimals: 3 },
  { name: "VATBASE", type: "N", length: 17, decimals: 3 },
  { name: "VATCODE", type: "C", length: 6 },
  { name: "CURRAMOUNT", type: "N", length: 17, decimals: 3 },
  { name: "CURRCODE", type: "C", length: 3 },
  { name: "CUREURBASE", type: "N", length: 17, decimals: 3 },
  { name: "VATTAX", type: "N", length: 17, decimals: 3 },
  { name: "VATIMPUT", type: "C", length: 6 },
  { name: "CURRATE", type: "N", length: 12, decimals: 5 },
  { name: "REMINDLEV", type: "N", length: 1 },
  { name: "MATCHNO", type: "C", length: 8 },
  { name: "OLDDATE", type: "D", length: 8 },
  { name: "ISMATCHED", type: "L", length: 1 },
  { name: "ISLOCKED", type: "L", length: 1 },
  { name: "ISIMPORTED", type: "L", length: 1 },
  { name: "ISPOSITIVE", type: "L", length: 1 },
  { name: "ISTEMP", type: "L", length: 1 },
  { name: "MEMOTYPE", type: "C", length: 1 },
  { name: "ISDOC", type: "L", length: 1 },
  { name: "DOCSTATUS", type: "C", length: 1 },
  { name: "DICFROM", type: "C", length: 16 },
  { name: "CODAKEY", type: "C", length: 11 },
];

export const CSF_FIELDS: DbfField[] = [
  { name: "NUMBER", type: "C", length: 10 },
  { name: "TYPE", type: "C", length: 1 },
  { name: "NAME1", type: "C", length: 40 },
  { name: "NAME2", type: "C", length: 40 },
  { name: "CIVNAME1", type: "C", length: 10 },
  { name: "CIVNAME2", type: "C", length: 10 },
  { name: "ADRESS1", type: "C", length: 40 },
  { name: "ADRESS2", type: "C", length: 40 },
  { name: "VATCAT", type: "C", length: 1 },
  { name: "COUNTRY", type: "C", length: 6 },
  { name: "VATNUMBER", type: "C", length: 15 },
  { name: "PAYCODE", type: "C", length: 10 },
  { name: "TELNUMBER", type: "C", length: 35 },
  { name: "FAXNUMBER", type: "C", length: 25 },
  { name: "BNKACCNT", type: "C", length: 40 },
  { name: "ZIPCODE", type: "C", length: 10 },
  { name: "CITY", type: "C", length: 40 },
  { name: "DEFLTPOST", type: "C", length: 8 },
  { name: "LANG", type: "C", length: 2 },
  { name: "CATEGORY", type: "C", length: 10 },
  { name: "CENTRAL", type: "C", length: 8 },
  { name: "VATCODE", type: "C", length: 10 },
  { name: "CURRENCY", type: "C", length: 3 },
];

/** Écritures au format WinBooks : une ligne par imputation (la ligne « tiers » porte le compte client / fournisseur). */
export function winbooksAct(entries: JournalEntry[], a: AccountingSettings) {
  const recs: Record<string, DbfValue>[] = [];
  for (const e of entries) {
    const dbkType = e.kind === "sale" || e.kind === "credit" ? 2 : 1;
    const doc = e.number.replace(/\D/g, "").slice(-8) || e.number.slice(0, 8);
    e.lines.forEach((l, i) => {
      const amount = round2(l.debit - l.credit);
      const partnerLine = l.account === a.customers || l.account === a.suppliers;
      recs.push({
        DBKCODE: e.journal,
        DBKTYPE: dbkType,
        DOCNUMBER: doc,
        DOCORDER: String(i + 1).padStart(3, "0"),
        OPCODE: "",
        ACCOUNTGL: l.account,
        ACCOUNTRP: partnerLine ? e.partner.code : "",
        BOOKYEAR: "",
        PERIOD: e.date.slice(5, 7),
        DATE: e.date,
        DATEDOC: e.date,
        DUEDATE: e.dueDate,
        COMMENT: (partnerLine ? `${e.number} ${e.partner.name}` : l.label).slice(0, 40),
        COMMENTEXT: "",
        AMOUNT: 0,
        AMOUNTEUR: amount,
        VATBASE: l.vatBase,
        VATCODE: l.vatCode,
        CURRAMOUNT: 0,
        CURRCODE: "EUR",
        CUREURBASE: 0,
        VATTAX: 0,
        VATIMPUT: "",
        CURRATE: 0,
        REMINDLEV: 0,
        MATCHNO: "",
        OLDDATE: "",
        ISMATCHED: false,
        ISLOCKED: false,
        ISIMPORTED: false,
        ISPOSITIVE: amount >= 0,
        ISTEMP: false,
        MEMOTYPE: "",
        ISDOC: i === 0,
        DOCSTATUS: "",
        DICFROM: "Biltov",
        CODAKEY: "",
      });
    });
  }
  return writeDbf(ACT_FIELDS, recs);
}

export function winbooksCsf(d: AccountData) {
  const cc = partnerCodes(d.clients);
  const sc = partnerCodes(d.suppliers);
  const recs: Record<string, DbfValue>[] = [
    ...d.clients.map((c) => ({ NUMBER: cc.get(c.id), TYPE: "1", NAME1: c.name, NAME2: c.contactName, ADRESS1: c.billing.street, ZIPCODE: c.billing.postcode, CITY: c.billing.city, COUNTRY: c.billing.country || "BE", VATNUMBER: vatNumberOf(c), VATCAT: c.kind === "assujetti" ? "1" : "0", TELNUMBER: c.phone, LANG: c.lang.toUpperCase(), CURRENCY: "EUR" })),
    ...d.suppliers.map((s) => ({ NUMBER: sc.get(s.id), TYPE: "2", NAME1: s.name, ADRESS1: s.address.street, ZIPCODE: s.address.postcode, CITY: s.address.city, COUNTRY: s.address.country || "BE", VATNUMBER: vatNumberOf(s), VATCAT: "1", TELNUMBER: s.phone, BNKACCNT: s.iban ?? "", LANG: "FR", CURRENCY: "EUR" })),
  ];
  return writeDbf(CSF_FIELDS, recs);
}

/** Retenues ONSS / SPF à reverser pour les factures de sous-traitance de la période. */
export function retentionsToTransfer(d: AccountData, from: string, to: string) {
  return d.purchases
    .filter((p) => p.type === "invoice" && p.date >= from && p.date < to && d.suppliers.find((s) => s.id === p.supplierId)?.kind === "subcontractor")
    .map((p) => ({ purchase: p, ...retentionFor(purchaseTotals(p).ht, p.retention, p.date) }))
    .filter((r) => r.total > 0);
}
