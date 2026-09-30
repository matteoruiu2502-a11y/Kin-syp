// Relances d'impayés conformes au droit belge, calculées à partir du moteur « tax/belgium ».

import { b2bFlatIndemnity, b2bInterestRate, b2cIndemnityCap, b2cMaxInterestRate, dunningPlan, lateInterest, type DunningStep } from "../tax/belgium";
import { todayIso } from "./defaults";
import { dt, fmtDate, LOCALE } from "./docText";
import { computeTotals, eur, round2 } from "./money";
import type { AccountData, Client, Doc, Job, Lang } from "./types";

export type ReminderState = { doc: Doc; job: Job | undefined; client: Client | undefined; b2c: boolean; step: number; plan: DunningStep[]; nextDate: string | null; due: boolean; fees: number; interest: number; blocked: string | null };

const reminderSends = (doc: Doc) => doc.sends.filter((s) => s.kind === "reminder").sort((a, b) => a.at.localeCompare(b.at));

/** Frais réclamables à une date : B2C seulement après le délai de 14 jours (plafonnés) ; B2B intérêts + forfait. */
export function feesFor(doc: Doc, b2c: boolean, plan: DunningStep[], today: string) {
  const t = computeTotals(doc);
  if (b2c) {
    const allowedFrom = plan[1]?.earliest;
    if (!allowedFrom || today < allowedFrom) return { fees: 0, interest: 0 };
    return { fees: b2cIndemnityCap(t.due, today), interest: lateInterest(t.due, b2cMaxInterestRate(today), allowedFrom, today) };
  }
  if (today <= doc.dueDate) return { fees: 0, interest: 0 };
  return { fees: b2bFlatIndemnity(today), interest: lateInterest(t.due, b2bInterestRate(today), doc.dueDate, today) };
}

export function reminderState(d: AccountData, doc: Doc, today = todayIso()): ReminderState {
  const job = d.jobs.find((j) => j.id === doc.jobId);
  const client = d.clients.find((c) => c.id === doc.clientId);
  const b2c = !client || client.kind === "particulier";
  const sends = reminderSends(doc);
  const first = sends[0];
  const plan = dunningPlan({ b2c, dueDate: doc.dueDate, firstReminderSent: first?.at.slice(0, 10), channel: first?.channel === "post" ? "postal" : "electronic" });
  const step = sends.length;
  const next = plan[step];
  const { fees, interest } = step === 0 ? { fees: 0, interest: 0 } : feesFor(doc, b2c, plan, today);
  const blocked = doc.dispute.active ? "Contestation / plan de paiement en cours : relances suspendues" : null;
  return { doc, job, client, b2c, step, plan, nextDate: next?.earliest ?? null, due: !blocked && !!next && next.earliest <= today && (doc.status === "issued" || doc.status === "partial"), fees, interest, blocked };
}

export function dueReminders(d: AccountData, today = todayIso()) {
  return d.docs
    .filter((x) => x.type === "invoice" && x.lockedAt && (x.status === "issued" || x.status === "partial"))
    .map((x) => reminderState(d, x, today))
    .filter((r) => r.due)
    .sort((a, b) => (a.nextDate ?? "").localeCompare(b.nextDate ?? ""));
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** Message de relance (modèle éditable des paramètres), dans la langue du client. */
export function reminderMessage(d: AccountData, r: ReminderState, lang?: Lang) {
  const l = lang ?? r.client?.lang ?? d.company.lang;
  const loc = LOCALE[l];
  const tpl = d.settings.reminderTemplates[Math.min(r.step, d.settings.reminderTemplates.length - 1)];
  const t = computeTotals(r.doc);
  const extra = round2(r.fees + r.interest);
  const b2cNote = {
    fr: `Ce premier rappel est gratuit. En l'absence de paiement dans les 14 jours, une indemnité de ${eur(b2cIndemnityCap(t.due), loc)} maximum et des intérêts de retard pourront être réclamés.`,
    nl: `Deze eerste herinnering is kosteloos. Bij gebrek aan betaling binnen 14 dagen kunnen een schadevergoeding van maximaal ${eur(b2cIndemnityCap(t.due), loc)} en nalatigheidsinteresten worden gevorderd.`,
    de: `Diese erste Erinnerung ist kostenlos. Erfolgt die Zahlung nicht innerhalb von 14 Tagen, können eine Entschädigung von höchstens ${eur(b2cIndemnityCap(t.due), loc)} und Verzugszinsen verlangt werden.`,
  }[l];
  const vars = {
    client: r.client?.contactName || r.client?.name || "",
    numero: r.doc.number ?? "",
    date: fmtDate(r.doc.issueDate, l),
    prestation: r.job?.name ?? "",
    montant: eur(t.due, loc),
    montant_total: eur(round2(t.due + extra), loc),
    frais: extra ? `${eur(r.fees, loc)} + ${eur(r.interest, loc)}` : eur(0, loc),
    echeance: fmtDate(r.doc.dueDate, l),
    iban: d.company.iban,
    communication: r.doc.structuredComm || r.doc.number || "",
    mention_b2c: r.b2c && r.step === 0 ? b2cNote : "",
    entreprise: d.company.name,
    bce: d.company.bce,
  };
  return { subject: fill(tpl.subject[l], vars), body: fill(tpl.body[l], vars).replace(/\n{3,}/g, "\n\n"), title: dt(l, "reminder") };
}

export const STEP_LABEL = (r: ReminderState) => (r.b2c ? ["1er rappel (gratuit)", "Relance avec frais", "Mise en demeure"] : ["Rappel", "Relance (intérêts + indemnité)", "Mise en demeure"])[Math.min(r.step, 2)];
