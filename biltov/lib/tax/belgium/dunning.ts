// Rappels d'impayés conformes au droit belge.
// Particuliers : Livre XIX CDE (1er rappel gratuit, délai de 14 jours, frais plafonnés).
// Professionnels : loi du 2 août 2002 (intérêts au taux commercial + indemnité forfaitaire).

import { legal } from "./config";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** n-ième jour ouvrable (lundi-vendredi) après une date. */
export function addBusinessDays(iso: string, n: number) {
  let d = iso;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * Fin du délai d'attente B2C : 14 jours calendrier, qui commencent le jour suivant
 * un envoi électronique, ou le 3e jour ouvrable après un envoi postal.
 * Aucun frais ni intérêt ne peut être réclamé avant le lendemain de cette date.
 */
export function b2cGraceEnd(firstReminderSent: string, channel: "electronic" | "postal") {
  const start = channel === "electronic" ? addDays(firstReminderSent, 1) : addBusinessDays(firstReminderSent, legal("b2c.postalStartBusinessDays", firstReminderSent));
  return addDays(start, legal("b2c.graceDays", firstReminderSent) - 1);
}

/** Indemnité forfaitaire maximale pour un consommateur (barème configurable). */
export function b2cIndemnityCap(amountDue: number, date?: string) {
  const scale = legal("b2c.indemnityScale", date);
  const tier = scale.find((t) => amountDue <= t.upTo)!;
  const raw = tier.fixed + (Math.max(0, amountDue - tier.base) * tier.percentAbove) / 100;
  return Math.round(Math.min(raw, "max" in tier && tier.max ? tier.max : Infinity) * 100) / 100;
}

/** Intérêts de retard simples entre deux dates. */
export function lateInterest(amount: number, annualRatePercent: number, from: string, to: string) {
  const days = Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);
  return Math.round(((amount * annualRatePercent) / 100) * (days / 365) * 100) / 100;
}

export const b2cMaxInterestRate = (date?: string) => legal("legal.interestRate", date) + legal("b2c.interestPointsAboveLegal", date);
export const b2bInterestRate = (date?: string) => legal("b2b.commercialRate", date);
export const b2bFlatIndemnity = (date?: string) => legal("b2b.flatIndemnity", date);

export type DunningStep = { kind: "free_reminder" | "reminder" | "formal_notice"; earliest: string; feesAllowed: boolean };

/**
 * Scénario de relance.
 * B2C : 1er rappel gratuit à l'échéance + 1 j, puis relances avec frais seulement après le délai de 14 jours.
 * B2B : rappel à J+7, relance à J+14 (intérêts + indemnité), mise en demeure à J+30.
 */
export function dunningPlan(opts: { b2c: boolean; dueDate: string; firstReminderSent?: string; channel?: "electronic" | "postal" }): DunningStep[] {
  if (!opts.b2c)
    return [
      { kind: "reminder", earliest: addDays(opts.dueDate, 7), feesAllowed: false },
      { kind: "reminder", earliest: addDays(opts.dueDate, 14), feesAllowed: true },
      { kind: "formal_notice", earliest: addDays(opts.dueDate, 30), feesAllowed: true },
    ];
  const first = { kind: "free_reminder" as const, earliest: addDays(opts.dueDate, 1), feesAllowed: false };
  const graceEnd = b2cGraceEnd(opts.firstReminderSent ?? first.earliest, opts.channel ?? "electronic");
  return [first, { kind: "reminder", earliest: addDays(graceEnd, 1), feesAllowed: true }, { kind: "formal_notice", earliest: addDays(graceEnd, 15), feesAllowed: true }];
}
