// Droits liés à l'abonnement : statut, forfait effectif, accès aux modules, quota de factures Peppol.
// Logique pure (sans navigateur ni réseau) partagée par l'application ET le serveur (server/),
// qui reste seul juge pour le quota Peppol et le statut de paiement.

import { GRACE_DAYS, PLANS, PLAN_ORDER, TRIAL, USAGE_ALERTS, planFor, type Cycle, type Feature, type PlanId } from "../plans";
import type { Permissions } from "../app/types";

export type SubStatus = "trial" | "active" | "past_due" | "unpaid" | "canceled" | "expired";

/** Abonnement d'une entreprise (enregistré par le serveur, transmis à l'application dans la licence signée). */
export type Subscription = {
  plan: PlanId | null; // null tant qu'aucun forfait n'a été choisi (essai)
  status: SubStatus;
  cycle: Cycle | null;
  startedAt: string; // début de l'essai ou de l'abonnement (ISO)
  trialEndsAt: string | null;
  periodStart: string | null; // période de facturation en cours (Stripe)
  periodEnd: string | null;
  graceUntil: string | null; // paiement échoué : fin du délai de grâce
  cancelAtPeriodEnd: boolean;
};

/** Factures envoyées via Peppol pendant une période d'usage (remise à zéro à chaque période). */
export type Usage = { periodStart: string; peppol: number };

/** Statut affiché : essai, actif, impayé (délai de grâce), expiré ou impayé (lecture seule). */
export type EffectiveStatus = "trial" | "active" | "past_due" | "expired" | "unpaid";

export type Entitlement = {
  status: EffectiveStatus;
  /** forfait dont les fonctionnalités s'appliquent (essai = forfait d'essai) */
  plan: PlanId;
  /** forfait souscrit (null pendant l'essai ou sans abonnement) */
  subscribed: PlanId | null;
  readOnly: boolean;
  features: ReadonlySet<Feature>;
  maxUsers: number | null;
  invoiceQuota: number;
  overagePrice: number | null;
  daysLeft: number | null; // essai : jours restants ; impayé : jours de grâce restants
  period: { start: string; end: string };
};

const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString();

/** Essai de départ d'une entreprise. */
export function trialSubscription(startedAt: string): Subscription {
  return { plan: null, status: "trial", cycle: null, startedAt, trialEndsAt: iso(Date.parse(startedAt) + TRIAL.days * DAY), periodStart: null, periodEnd: null, graceUntil: null, cancelAtPeriodEnd: false };
}

/** Statut réel à un instant donné (essai terminé, délai de grâce écoulé, résiliation arrivée à échéance…). */
export function effectiveStatus(sub: Subscription, now = Date.now()): EffectiveStatus {
  switch (sub.status) {
    case "trial":
      return sub.trialEndsAt && Date.parse(sub.trialEndsAt) > now ? "trial" : "expired";
    case "active":
      return sub.periodEnd && sub.cancelAtPeriodEnd && Date.parse(sub.periodEnd) <= now ? "expired" : "active";
    case "past_due":
      return sub.graceUntil && Date.parse(sub.graceUntil) > now ? "past_due" : "unpaid";
    case "canceled":
      return sub.periodEnd && Date.parse(sub.periodEnd) > now ? "active" : "expired";
    case "unpaid":
      return "unpaid";
    default:
      return "expired";
  }
}

/** Ajoute n mois à une date en gardant le jour (borné à la fin du mois). */
function addMonths(t: number, n: number) {
  const d = new Date(t);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}

/**
 * Période d'usage en cours (pour le compteur de factures) : la durée de l'essai, puis des tranches
 * d'un mois à partir du début de l'abonnement (en annuel aussi : le quota est mensuel).
 */
export function usagePeriod(sub: Subscription, now = Date.now()): { start: string; end: string } {
  if (sub.status === "trial" || !sub.plan) return { start: sub.startedAt, end: sub.trialEndsAt ?? iso(Date.parse(sub.startedAt) + TRIAL.days * DAY) };
  const anchor = Date.parse(sub.periodStart ?? sub.startedAt);
  if (now < anchor) return { start: iso(anchor), end: iso(addMonths(anchor, 1)) };
  let n = Math.max(0, (new Date(now).getUTCFullYear() - new Date(anchor).getUTCFullYear()) * 12 + new Date(now).getUTCMonth() - new Date(anchor).getUTCMonth() - 1);
  while (addMonths(anchor, n + 1) <= now) n++;
  return { start: iso(addMonths(anchor, n)), end: iso(addMonths(anchor, n + 1)) };
}

/** Droits de l'entreprise à un instant donné. */
export function entitlementOf(sub: Subscription, now = Date.now()): Entitlement {
  const status = effectiveStatus(sub, now);
  const trial = status === "trial" || (sub.status === "trial" && !sub.plan);
  const plan: PlanId = trial ? TRIAL.plan : (sub.plan ?? TRIAL.plan);
  const cfg = PLANS[plan];
  const readOnly = status === "expired" || status === "unpaid";
  const daysLeft = status === "trial" && sub.trialEndsAt ? Math.max(0, Math.ceil((Date.parse(sub.trialEndsAt) - now) / DAY)) : status === "past_due" && sub.graceUntil ? Math.max(0, Math.ceil((Date.parse(sub.graceUntil) - now) / DAY)) : null;
  return {
    status,
    plan,
    subscribed: sub.plan,
    readOnly,
    features: new Set(cfg.features),
    maxUsers: cfg.maxUsers,
    invoiceQuota: status === "trial" ? TRIAL.peppolInvoices : cfg.invoicesPerMonth,
    // pas de dépassement payant pendant l'essai
    overagePrice: status === "trial" ? null : cfg.overagePrice,
    daysLeft,
    period: usagePeriod(sub, now),
  };
}

/** Fonction centrale : l'entreprise a-t-elle accès à cette fonctionnalité avec son forfait ? */
export const canAccess = (ent: Pick<Entitlement, "features">, feature: Feature) => ent.features.has(feature);

/** Forfait à proposer pour débloquer une fonctionnalité. */
export const upgradeFor = (feature: Feature) => planFor(feature);

/** Forfait supérieur (null = déjà au maximum). */
export const nextPlan = (plan: PlanId): PlanId | null => PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1] ?? null;

// ── Compteur de factures Peppol ─────────────────────────────────────────────

/** Factures déjà envoyées pendant la période en cours (0 si le compteur date d'une période précédente). */
export const usedInPeriod = (usage: Usage | null | undefined, period: { start: string }) => (usage && usage.periodStart === period.start ? usage.peppol : 0);

/** Compte un envoi RÉUSSI : remise à zéro automatique au changement de période. */
export function recordSend(usage: Usage | null | undefined, period: { start: string }): Usage {
  return { periodStart: period.start, peppol: usedInPeriod(usage, period) + 1 };
}

export type SendCheck = { ok: true; overage: boolean } | { ok: false; reason: "readonly" | "quota"; upgrade: PlanId | null };

/** Peut-on envoyer une facture de plus ? Bloqué au quota (Starter, Pro, essai) ; dépassement facturé sur le Max. */
export function canSendInvoice(ent: Entitlement, used: number): SendCheck {
  if (ent.readOnly) return { ok: false, reason: "readonly", upgrade: null };
  if (used < ent.invoiceQuota) return { ok: true, overage: false };
  if (ent.overagePrice !== null) return { ok: true, overage: true };
  return { ok: false, reason: "quota", upgrade: ent.status === "trial" ? null : nextPlan(ent.plan) };
}

/** Factures au-delà du quota (facturées sur le Max). */
export const overageCount = (ent: Pick<Entitlement, "invoiceQuota" | "overagePrice">, used: number) => (ent.overagePrice === null ? 0 : Math.max(0, used - ent.invoiceQuota));

/** Seuil d'alerte atteint (80 ou 100 %), ou null. */
export function usageAlert(ent: Pick<Entitlement, "invoiceQuota">, used: number): (typeof USAGE_ALERTS)[number] | null {
  const pct = ent.invoiceQuota ? (used / ent.invoiceQuota) * 100 : 100;
  return [...USAGE_ALERTS].reverse().find((a) => pct >= a) ?? null;
}

// ── Utilisateurs et droits ───────────────────────────────────────────────────

/** Utilisateurs comptés : le titulaire du compte + les membres actifs de l'équipe. */
export const activeUsers = (members: { role: string; active: boolean }[]) => 1 + members.filter((m) => m.active && m.role !== "owner").length;

/** Peut-on ajouter (ou réactiver) un utilisateur ? */
export const canAddUser = (ent: Pick<Entitlement, "maxUsers">, users: number) => ent.maxUsers === null || users < ent.maxUsers;

/**
 * Droits effectifs = droits du rôle limités par le forfait : un module hors forfait passe à « aucun accès »,
 * et tout passe en lecture seule si l'abonnement est expiré ou impayé. Aucune donnée n'est supprimée.
 */
export function capPermissions(p: Permissions, ent: Pick<Entitlement, "features" | "readOnly">): Permissions {
  const out = { ...p };
  for (const m of Object.keys(out) as (keyof Permissions)[]) {
    if (!ent.features.has(m)) out[m] = "none";
    else if (ent.readOnly && out[m] === "edit") out[m] = "read";
  }
  return out;
}

// ── Changement de forfait ────────────────────────────────────────────────────

export type DowngradeIssue = { kind: "users"; current: number; max: number } | { kind: "feature"; feature: Feature };

/**
 * Passage à un autre forfait : ce qui dépasse les limites du forfait visé. Les utilisateurs en trop
 * doivent être désactivés avant d'appliquer ; les modules non inclus seront grisés (données conservées).
 */
export function downgradeIssues(target: PlanId, ctx: { users: number; usedFeatures: Feature[] }): DowngradeIssue[] {
  const cfg = PLANS[target];
  const out: DowngradeIssue[] = [];
  if (cfg.maxUsers !== null && ctx.users > cfg.maxUsers) out.push({ kind: "users", current: ctx.users, max: cfg.maxUsers });
  for (const f of ctx.usedFeatures) if (!cfg.features.includes(f)) out.push({ kind: "feature", feature: f });
  return out;
}

/** Le changement peut-il être appliqué ? (seul le nombre d'utilisateurs bloque ; les modules sont simplement grisés) */
export const downgradeBlocked = (issues: DowngradeIssue[]) => issues.some((i) => i.kind === "users");

/** Fonctionnalités réellement utilisées (données présentes) : sert à prévenir avant un passage à un forfait inférieur. */
export function featuresInUse(d: {
  members: { role: string; active: boolean; permissions?: object | null }[];
  stockMoves: unknown[];
  purchases: unknown[];
  vehicles: unknown[];
  tools: unknown[];
  contracts: unknown[];
  events: unknown[];
  records: unknown[];
  timeEntries: unknown[];
  tasks: unknown[];
  weatherDays: unknown[];
  suppliers: { kind: string }[];
  settings: { rolePermissions?: object };
}): Feature[] {
  const out: Feature[] = [];
  const add = (f: Feature, used: unknown) => used && out.push(f);
  add("users", d.members.some((m) => m.active && m.role !== "owner"));
  add("stock", d.stockMoves.length);
  add("purchases", d.purchases.length);
  add("fleet", d.vehicles.length);
  add("tools", d.tools.length);
  add("contracts", d.contracts.length);
  add("planning", d.events.length);
  add("modules", d.records.length);
  add("time", d.timeEntries.length);
  add("worker", d.members.some((m) => m.active && m.role === "worker"));
  add("gantt", d.tasks.length);
  add("weather", d.weatherDays.length);
  add("subcontractors", d.suppliers.some((s) => s.kind === "subcontractor"));
  add("customRoles", Object.keys(d.settings.rolePermissions ?? {}).length || d.members.some((m) => m.permissions && Object.keys(m.permissions).length));
  return out;
}
