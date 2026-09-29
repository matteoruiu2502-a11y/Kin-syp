// Relances d'impayés : J+7, J+14 et J+21 après l'échéance, avec un ton de plus en plus ferme.

import { addDays, todayIso } from "./defaults";
import { computeTotals, eur } from "./money";
import { fmtDate } from "./legal";
import type { Company, Doc, Job } from "./types";

export const REMINDER_STEPS = [
  { day: 7, title: "Rappel courtois" },
  { day: 14, title: "Relance ferme" },
  { day: 21, title: "Mise en demeure" },
] as const;

export type DueReminder = { doc: Doc; job: Job; step: number; date: string; overdueDays: number };

const sentSteps = (doc: Doc) => new Set(doc.sends.filter((s) => s.kind === "reminder").map((s) => s.step));

/** Relances dues aujourd'hui (ou en retard) pour les factures émises non payées. */
export function dueReminders(docs: Doc[], jobs: Job[], today = todayIso()): DueReminder[] {
  const out: DueReminder[] = [];
  for (const doc of docs) {
    if (doc.type !== "invoice" || doc.status !== "issued") continue;
    const job = jobs.find((j) => j.id === doc.jobId);
    if (!job) continue;
    // Prochaine étape non envoyée, si sa date est atteinte
    const sent = sentSteps(doc);
    const step = REMINDER_STEPS.findIndex((_, k) => !sent.has(k));
    if (step === -1) continue;
    const date = addDays(doc.dueDate, REMINDER_STEPS[step].day);
    if (date > today) continue;
    out.push({ doc, job, step, date, overdueDays: Math.round((Date.parse(today) - Date.parse(doc.dueDate)) / 86_400_000) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function reminderSchedule(doc: Doc) {
  const sent = sentSteps(doc);
  return REMINDER_STEPS.map((s, i) => ({ ...s, date: addDays(doc.dueDate, s.day), sent: sent.has(i) }));
}

export function reminderMessage(step: number, doc: Doc, job: Job, company: Company) {
  const amount = eur(computeTotals(doc).due);
  const ref = `la facture ${doc.number} du ${fmtDate(doc.issueDate)} (${amount})`;
  const pay = company.iban ? `\n\nRèglement par virement : IBAN ${company.iban}, référence ${doc.number}.` : "";
  const sign = `\n\n${company.owner || company.name}\n${company.name}${company.phone ? ` — ${company.phone}` : ""}`;
  const hello = `Bonjour ${job.client},`;
  const bodies = [
    `${hello}\n\nSauf erreur de notre part, ${ref}, arrivée à échéance le ${fmtDate(doc.dueDate)}, reste à régler. Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message.${pay}${sign}`,
    `${hello}\n\nMalgré notre précédent rappel, ${ref} demeure impayée à ce jour. Nous vous remercions de procéder à son règlement sous 7 jours.${pay}${sign}`,
    `${hello}\n\nPar la présente, nous vous mettons en demeure de régler ${ref}, échue le ${fmtDate(doc.dueDate)}, dans un délai de 8 jours à compter de la réception de ce message. À défaut, nous engagerons les démarches de recouvrement ; des pénalités de retard${job.clientType === "professionnel" ? " et l'indemnité forfaitaire de 40 € pour frais de recouvrement" : ""} sont applicables.${pay}${sign}`,
  ];
  return { subject: `${REMINDER_STEPS[step].title} — facture ${doc.number}`, body: bodies[step] };
}
