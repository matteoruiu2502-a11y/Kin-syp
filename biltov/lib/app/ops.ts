// Opérations métier pures : (données) → (nouvelles données, résultat). Testées par vitest.

import { communicationForInvoice, decideVat, isBce, isBeVat, isIban, type VatCode, type VatContext } from "../tax/belgium";
import { addDays, newDoc, newLine, nextNumber, nowIso, todayIso, uid } from "./defaults";
import { computeTotals, countsInTotal, lineTotal, round2 } from "./money";
import type { AccountData, AuditEntry, Client, Doc, DocKind, Job, Line, Payment, SendLog } from "./types";

type Op<R> = [AccountData, R];

export const clientOf = (d: AccountData, id: string) => d.clients.find((c) => c.id === id);
export const jobOf = (d: AccountData, id: string) => d.jobs.find((j) => j.id === id);

export function audit(d: AccountData, action: string, entity: string, entityId: string, detail = "", user = "moi"): AccountData {
  const entry: AuditEntry = { at: nowIso(), user, action, entity, entityId, detail };
  return { ...d, audit: [entry, ...d.audit].slice(0, 5000) };
}

const replaceDoc = (d: AccountData, doc: Doc): AccountData => ({ ...d, docs: d.docs.some((x) => x.id === doc.id) ? d.docs.map((x) => (x.id === doc.id ? doc : x)) : [doc, ...d.docs] });

// ——— TVA ————————————————————————————————————————————————————————————————

export function vatContext(d: AccountData, job: Job, client: Client | undefined, date = todayIso()): VatContext {
  return {
    date,
    companyRegime: d.company.vatRegime,
    clientKind: client?.kind ?? "particulier",
    workKind: job.workKind,
    privateHousing: job.privateHousing,
    firstOccupationYear: job.firstOccupationYear,
  };
}

/** Applique le moteur de TVA aux lignes non surchargées par l'artisan. */
export function applyVat(d: AccountData, doc: Doc): Doc {
  const job = jobOf(d, doc.jobId);
  if (!job) return doc;
  const ctx = vatContext(d, job, clientOf(d, doc.clientId), doc.issueDate);
  return { ...doc, lines: doc.lines.map((l) => (l.kind !== "item" || l.vatOverridden ? l : { ...l, vat: decideVat(ctx, l.category).code })) };
}

// ——— Devis ——————————————————————————————————————————————————————————————

export function createQuote(d: AccountData, jobId: string, lines: Line[] = [], extra: Partial<Doc> = {}): Op<Doc> {
  const job = jobOf(d, jobId)!;
  const client = clientOf(d, job.clientId);
  const { number, counters } = nextNumber(d.settings, "quote");
  let doc = newDoc({
    jobId,
    clientId: job.clientId,
    type: "quote",
    number,
    lang: client?.lang ?? d.company.lang,
    lines,
    depositPercent: d.settings.depositPercent,
    validUntil: addDays(todayIso(), d.settings.quoteValidityDays),
    ...extra,
  });
  doc = applyVat(d, doc);
  let next: AccountData = { ...d, settings: { ...d.settings, counters }, docs: [doc, ...d.docs] };
  next = audit(next, "create", "quote", doc.id, number);
  return [next, doc];
}

/** Nouvelle version d'un devis (même numéro, suffixe v2, v3…). L'ancienne est conservée. */
export function newQuoteVersion(d: AccountData, quoteId: string): Op<Doc> {
  const q = d.docs.find((x) => x.id === quoteId)!;
  const root = q.number?.replace(/ v\d+$/, "") ?? "";
  const version = Math.max(...d.docs.filter((x) => x.number?.startsWith(root) && x.type === "quote").map((x) => x.version)) + 1;
  const doc: Doc = { ...q, id: uid(), version, number: `${root} v${version}`, previousId: q.id, status: "draft", signature: null, sends: [], lockedAt: null, lines: q.lines.map((l) => ({ ...l, id: uid() })), issueDate: todayIso(), validUntil: addDays(todayIso(), d.settings.quoteValidityDays) };
  return [audit(replaceDoc(d, doc), "version", "quote", doc.id, doc.number ?? ""), doc];
}

export function duplicateQuote(d: AccountData, quoteId: string, jobId?: string): Op<Doc> {
  const q = d.docs.find((x) => x.id === quoteId)!;
  const target = jobId ? jobOf(d, jobId)! : jobOf(d, q.jobId)!;
  return createQuote(d, target.id, q.lines.map((l) => ({ ...l, id: uid(), vatOverridden: false })), { notes: q.notes, globalDiscountPercent: q.globalDiscountPercent, billingMode: q.billingMode, milestones: q.milestones.map((m) => ({ ...m, id: uid(), invoiced: false })) });
}

/** Avenant / travaux supplémentaires : nouveau devis rattaché au chantier et au devis d'origine. */
export function createAmendment(d: AccountData, quoteId: string): Op<Doc> {
  const q = d.docs.find((x) => x.id === quoteId)!;
  return createQuote(d, q.jobId, [], { isAmendment: true, sourceId: q.id, notes: `Avenant au devis ${q.number}.` });
}

export function signQuote(d: AccountData, quoteId: string, signature: NonNullable<Doc["signature"]>): AccountData {
  const q = d.docs.find((x) => x.id === quoteId)!;
  let next = replaceDoc(d, { ...q, signature, status: "accepted" });
  // Devis accepté → chantier accepté (création automatique du suivi)
  next = { ...next, jobs: next.jobs.map((j) => (j.id === q.jobId && ["lead", "draft", "sent"].includes(j.status) ? { ...j, status: "accepted", amount: computeTotals(q).htva } : j)) };
  return audit(next, "sign", "quote", q.id, `${signature.name}`);
}

// ——— Facturation ————————————————————————————————————————————————————————

/** Montant HTVA déjà facturé sur un devis (factures émises, hors notes de crédit), par code TVA. */
export function invoicedByCode(d: AccountData, quoteId: string) {
  const map = new Map<VatCode, number>();
  for (const inv of d.docs.filter((x) => x.sourceId === quoteId && x.type === "invoice" && x.lockedAt && x.status !== "cancelled" && x.kind !== "final" && x.kind !== "full"))
    for (const r of computeTotals(inv).vatRows) map.set(r.code, round2((map.get(r.code) ?? 0) + r.base));
  return map;
}

/** Avancement cumulé déjà facturé par ligne de devis (situations). */
export function progressInvoiced(d: AccountData, quoteId: string) {
  const map = new Map<string, number>();
  for (const inv of d.docs.filter((x) => x.sourceId === quoteId && x.kind === "situation" && x.lockedAt && x.status !== "cancelled"))
    for (const l of inv.lines) if (l.articleId === null && l.progressPercent) map.set(l.label, Math.max(map.get(l.label) ?? 0, l.progressPercent));
  return map;
}

export function quoteToInvoice(d: AccountData, quoteId: string, kind: DocKind, opts: { percent?: number; progress?: Record<string, number>; milestoneId?: string } = {}): Op<Doc> {
  const q = d.docs.find((x) => x.id === quoteId)!;
  const items = q.lines.filter(countsInTotal);
  let lines: Line[] = [];
  let deductions: Doc["deductions"] = [];
  let notes = "";

  if (kind === "deposit") {
    const pct = opts.percent ?? q.depositPercent;
    const ms = opts.milestoneId ? q.milestones.find((m) => m.id === opts.milestoneId) : null;
    const share = ms ? ms.percent : pct;
    lines = computeTotals(q).vatRows.map((r) =>
      newLine({ label: ms ? `${ms.label} — ${share} % du devis ${q.number}` : `Acompte de ${share} % sur devis ${q.number}`, qty: 1, unit: "forfait", unitPrice: round2((r.base * share) / 100), vat: r.code, vatOverridden: true, category: "labour" }),
    );
  } else if (kind === "situation") {
    const prev = progressInvoiced(d, quoteId);
    lines = items
      .map((l): Line | null => {
        const cumul = Math.min(100, opts.progress?.[l.id] ?? 0);
        const delta = cumul - (prev.get(l.label) ?? 0);
        return delta > 0 ? { ...l, id: uid(), qty: round2((l.qty * delta) / 100), progressPercent: cumul, articleId: null } : null;
      })
      .filter((l): l is Line => !!l);
    notes = `État d'avancement sur devis ${q.number}.`;
  } else {
    lines = items.map((l) => ({ ...l, id: uid(), optional: false, selected: true }));
    if (kind === "final") {
      deductions = [...invoicedByCode(d, quoteId).entries()].map(([vat, amount]) => ({ label: "Acomptes et situations déjà facturés", amount, vat }));
      notes = `Facture finale du devis ${q.number}.`;
    }
  }

  const doc = newDoc({
    jobId: q.jobId,
    clientId: q.clientId,
    type: "invoice",
    kind,
    lang: q.lang,
    lines,
    deductions,
    globalDiscountPercent: kind === "deposit" ? 0 : q.globalDiscountPercent,
    // retenue de garantie (souvent 5 %) sur les situations et la facture finale des clients professionnels / publics
    retentionPercent: kind !== "deposit" && clientOf(d, q.clientId)?.kind !== "particulier" ? d.settings.retentionGuaranteePercent : 0,
    sourceId: quoteId,
    dueDate: addDays(todayIso(), kind === "deposit" ? 8 : d.settings.paymentTermsDays),
    notes: notes || q.notes,
  });
  let next = replaceDoc(d, doc);
  if (opts.milestoneId) next = replaceDoc(next, { ...q, milestones: q.milestones.map((m) => (m.id === opts.milestoneId ? { ...m, invoiced: true } : m)) });
  return [audit(next, "create", "invoice", doc.id, kind), doc];
}

export function toProforma(d: AccountData, quoteId: string): Op<Doc> {
  const q = d.docs.find((x) => x.id === quoteId)!;
  const { number, counters } = nextNumber(d.settings, "proforma");
  const doc = newDoc({ ...q, id: uid(), type: "proforma", number, status: "draft", sourceId: q.id, signature: null, sends: [], payments: [], lockedAt: null });
  return [{ ...replaceDoc(d, doc), settings: { ...d.settings, counters } }, doc];
}

/** Mentions / champs obligatoires manquants : l'émission est bloquée tant que la liste n'est pas vide. */
export function issueBlockers(d: AccountData, doc: Doc): string[] {
  const c = d.company;
  const client = clientOf(d, doc.clientId);
  const out: string[] = [];
  if (!c.name.trim()) out.push("Nom de l'entreprise");
  if (!c.address.street.trim() || !c.address.city.trim()) out.push("Adresse de l'entreprise");
  if (!isBce(c.bce)) out.push("Numéro d'entreprise (BCE) valide");
  if (c.vatRegime === "normal" && !isBce(c.bce)) out.push("Numéro de TVA");
  if (doc.type !== "credit" && !isIban(c.iban)) out.push("IBAN valide");
  if (!client) out.push("Client");
  else {
    if (!client.name.trim()) out.push("Nom du client");
    if (!client.billing.street.trim() || !client.billing.city.trim()) out.push("Adresse du client");
    if (client.kind === "assujetti" && !isBeVat(client.vatNumber)) out.push("Numéro de TVA du client assujetti");
  }
  const items = doc.lines.filter((l) => l.kind === "item");
  if (!items.length) out.push("Au moins une ligne");
  if (items.some((l) => l.toPrice || !l.label.trim())) out.push("Lignes « à chiffrer » ou sans désignation");
  if (doc.type === "invoice" && !doc.dueDate) out.push("Date d'échéance");
  return out;
}

export function issueDoc(d: AccountData, docId: string): Op<Doc | null> {
  const doc = d.docs.find((x) => x.id === docId);
  if (!doc || doc.lockedAt || doc.type === "quote" || doc.type === "proforma") return [d, null];
  if (issueBlockers(d, doc).length) return [d, null];
  const series = doc.type === "credit" ? "credit" : "invoice";
  const { number, counters } = nextNumber(d.settings, series);
  const client = clientOf(d, doc.clientId);
  const peppol: Doc["peppol"] = client?.kind === "assujetti" && isBeVat(client.vatNumber) ? { status: "ready" } : { status: "none" };
  const issued: Doc = { ...doc, number, status: "issued", issueDate: todayIso(), lockedAt: nowIso(), structuredComm: communicationForInvoice(number), peppol };
  let next: AccountData = { ...replaceDoc(d, issued), settings: { ...d.settings, counters } };
  if (doc.type === "credit" && doc.sourceId) {
    const src = next.docs.find((x) => x.id === doc.sourceId);
    if (src && computeTotals(doc).tvac >= computeTotals(src).payable - 0.005) next = replaceDoc(next, { ...src, status: "cancelled" });
  }
  return [audit(next, "issue", doc.type, issued.id, number), issued];
}

export function creditNote(d: AccountData, invoiceId: string): Op<Doc | null> {
  const inv = d.docs.find((x) => x.id === invoiceId);
  if (!inv?.lockedAt || inv.type !== "invoice") return [d, null];
  const doc = newDoc({ jobId: inv.jobId, clientId: inv.clientId, type: "credit", lang: inv.lang, lines: inv.lines.map((l) => ({ ...l, id: uid() })), deductions: inv.deductions, globalDiscountPercent: inv.globalDiscountPercent, sourceId: inv.id, notes: `Note de crédit relative à la facture ${inv.number}.` });
  return [audit(replaceDoc(d, doc), "create", "credit", doc.id, inv.number ?? ""), doc];
}

export function addPayment(d: AccountData, docId: string, p: Omit<Payment, "id">): AccountData {
  const doc = d.docs.find((x) => x.id === docId)!;
  const payments = [...doc.payments, { ...p, id: uid() }];
  const t = computeTotals({ ...doc, payments });
  const status = t.due <= 0.005 ? "paid" : "partial";
  return audit(replaceDoc(d, { ...doc, payments, status }), "payment", doc.type, doc.id, `${p.amount} ${p.method}`);
}

export function logSend(d: AccountData, docId: string, log: Omit<SendLog, "at">): AccountData {
  const doc = d.docs.find((x) => x.id === docId)!;
  const status = (doc.type === "quote" || doc.type === "proforma") && doc.status === "draft" && log.kind === "document" ? "sent" : doc.status;
  let next = replaceDoc(d, { ...doc, sends: [...doc.sends, { ...log, at: nowIso() }], status });
  if (doc.type === "quote" && log.kind === "document") next = { ...next, jobs: next.jobs.map((j) => (j.id === doc.jobId && (j.status === "draft" || j.status === "lead") ? { ...j, status: "sent" } : j)) };
  return audit(next, "send", doc.type, doc.id, `${log.kind} ${log.channel}`);
}

// ——— Suivi financier ————————————————————————————————————————————————————

/** Résumé par chantier : devis signé (+ avenants), facturé, encaissé, reste à facturer / encaisser, marge. */
export function jobFinance(d: AccountData, jobId: string) {
  const docs = d.docs.filter((x) => x.jobId === jobId);
  const signed = docs.filter((x) => x.type === "quote" && x.status === "accepted");
  const quoted = round2(signed.reduce((s, q) => s + computeTotals(q).htva, 0));
  const invoices = docs.filter((x) => x.type === "invoice" && x.lockedAt && x.status !== "cancelled");
  const credits = docs.filter((x) => x.type === "credit" && x.lockedAt);
  // les factures finales déduisent déjà les acomptes : on somme la base nette
  const invoiced = round2(invoices.reduce((s, x) => s + computeTotals(x).htva, 0) - credits.reduce((s, x) => s + computeTotals(x).htva, 0));
  const invoicedTvac = round2(invoices.reduce((s, x) => s + computeTotals(x).payable, 0) - credits.reduce((s, x) => s + computeTotals(x).tvac, 0));
  const cashed = round2(invoices.reduce((s, x) => s + computeTotals(x).paid, 0));
  const purchases = round2(d.purchases.filter((p) => p.jobId === jobId && p.type === "invoice").reduce((s, p) => s + p.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0), 0));
  const vehicleCosts = d.vehicles.flatMap((v) => v.costs).filter((c) => c.jobId === jobId).reduce((s, c) => s + c.amount, 0);
  const rentals = d.records.filter((r) => r.module === "rentals" && r.jobId === jobId && r.fields.billTo !== "client").reduce((s, r) => s + Number(r.fields.cost ?? 0), 0);
  const expenses = round2(d.expenses.filter((e) => e.jobId === jobId).reduce((s, e) => s + e.amountTTC / (1 + e.vat / 100), 0) + vehicleCosts + rentals);
  const labour = round2(d.timeEntries.filter((t) => t.jobId === jobId).reduce((s, t) => s + t.hours * (d.members.find((m) => m.id === t.memberId)?.hourlyCost ?? 0), 0));
  const plannedCost = round2(signed.reduce((s, q) => s + computeTotals(q).cost, 0));
  const revenue = Math.max(quoted, invoiced);
  const costs = round2(purchases + expenses + labour);
  return {
    quoted,
    invoiced,
    invoicedTvac,
    cashed,
    toInvoice: round2(Math.max(0, quoted - invoiced)),
    toCash: round2(Math.max(0, invoicedTvac - cashed)),
    purchases,
    expenses,
    labour,
    costs,
    plannedCost,
    margin: round2(revenue - costs),
    marginRate: revenue ? Math.round(((revenue - costs) / revenue) * 100) : 0,
  };
}

export const lineHtva = lineTotal;
