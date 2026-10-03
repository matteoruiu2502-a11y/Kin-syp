// Contrats d'entretien récurrents (tonte, taille, entretien chaudière…) : échéances, facture et passage au planning.

import { addDays, newDoc, newJob, newLine, todayIso, uid } from "./defaults";
import { applyVat, audit } from "./ops";
import type { AccountData, Contract, ContractFrequency, Doc, PlanningEvent } from "./types";

const MONTHS: Record<ContractFrequency, number> = { weekly: 0, monthly: 1, quarterly: 3, yearly: 12 };

/** Date de l'échéance suivante (fin de mois respectée : 31/01 + 1 mois → 28/02 ou 29/02). */
export function nextOccurrence(date: string, f: ContractFrequency): string {
  if (f === "weekly") return addDays(date, 7);
  const [y, m, d] = date.split("-").map(Number);
  const idx = y * 12 + (m - 1) + MONTHS[f];
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export const dueContracts = (d: AccountData, horizonDays = 7, today = todayIso()) => d.contracts.filter((c) => c.active && c.nextDate <= addDays(today, horizonDays) && (!c.endDate || c.nextDate <= c.endDate));

export const contractAmount = (c: Contract) => c.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
export const yearlyValue = (c: Contract) => contractAmount(c) * (c.frequency === "weekly" ? 52 : 12 / MONTHS[c.frequency]);

/** Génère l'échéance : facture en brouillon + intervention au planning, puis avance la date suivante. */
export function generateOccurrence(d: AccountData, contractId: string): [AccountData, { invoice: Doc; event: PlanningEvent } | null] {
  const c = d.contracts.find((x) => x.id === contractId);
  if (!c || !c.active) return [d, null];
  let next = d;
  let jobId = c.jobId;
  if (!jobId || !next.jobs.some((j) => j.id === jobId)) {
    const client = next.clients.find((x) => x.id === c.clientId);
    const job = newJob({ clientId: c.clientId, name: `${c.title}${client ? ` — ${client.name}` : ""}`, status: "in_progress", workKind: "livraison", privateHousing: false });
    next = { ...next, jobs: [job, ...next.jobs] };
    jobId = job.id;
  }
  const client = next.clients.find((x) => x.id === c.clientId);
  let invoice = newDoc({
    jobId,
    clientId: c.clientId,
    type: "invoice",
    lang: client?.lang ?? next.company.lang,
    workDate: c.nextDate,
    dueDate: addDays(c.nextDate, next.settings.paymentTermsDays),
    lines: c.lines.map((l) => newLine({ label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, category: l.category })),
    notes: `${c.title} — ${c.nextDate}`,
  });
  invoice = applyVat(next, invoice);
  const event: PlanningEvent = { id: uid(), kind: "maintenance", title: c.title, jobId, clientId: c.clientId, memberIds: c.memberIds, start: `${c.nextDate}T08:00`, end: `${c.nextDate}T12:00`, notes: c.lines.map((l) => `${l.qty} ${l.unit} ${l.label}`).join("\n"), status: "planned" };
  const updated: Contract = { ...c, jobId, nextDate: nextOccurrence(c.nextDate, c.frequency), history: [...c.history, { date: c.nextDate, invoiceId: invoice.id, eventId: event.id }] };
  next = { ...next, docs: [invoice, ...next.docs], events: [event, ...next.events], contracts: next.contracts.map((x) => (x.id === c.id ? updated : x)) };
  return [audit(next, "contract", "contract", c.id, c.nextDate), { invoice, event }];
}

