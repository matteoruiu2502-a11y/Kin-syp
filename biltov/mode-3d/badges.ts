// Badges et éléments de la scène calculés à partir des VRAIES données de l'application.
// Aucune logique métier propre : on réutilise les fonctions existantes (stock, devis, factures, planning).
// Chaque compteur ne tient compte que de ce que l'utilisateur a le droit de voir.

import type { AccountData, Member, PermModule } from "@/lib/app/types";
import { openInvoices, pendingQuotes } from "@/lib/app/finance";
import { jobState, plannedJobs } from "@/lib/app/gantt";

export type Tone = "danger" | "warning" | "ok" | "neutral";
export type Badge = { count: number; tone: Tone; text: string };
export type TFn = (fr: string, vars?: Record<string, string | number>) => string;

export type BadgeCtx = {
  data: AccountData;
  /** droit de lecture sur un module (mêmes règles que le mode normal) */
  can: (m: PermModule) => boolean;
  me: Member | null;
  today: string;
  t: TFn;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Articles suivis en stock sous leur stock minimum (même règle que l'écran Stock). */
export function lowStockCount(d: Pick<AccountData, "articles" | "stockMoves">) {
  const level = new Map<string, number>();
  for (const m of d.stockMoves) level.set(m.articleId, (level.get(m.articleId) ?? 0) + m.qty);
  return d.articles.filter((a) => a.active && (a.type === "supply" || a.type === "equipment") && a.minStock > 0 && Math.round((level.get(a.id) ?? 0) * 100) / 100 < a.minStock).length;
}

/** Personnes ayant pointé aujourd'hui. */
export const clockedInToday = (d: Pick<AccountData, "timeEntries">, today: string) => new Set(d.timeEntries.filter((e) => e.date === today).map((e) => e.memberId));

/** Chantiers planifiés dont la fin prévue est dépassée (même règle que le Gantt). */
export const lateJobsCount = (d: Pick<AccountData, "jobs" | "tasks">, today: string) => plannedJobs(d).filter((j) => jobState(d, j, today) === "late").length;

/** Intempéries déclarées qui couvrent aujourd'hui. */
export const weatherTodayCount = (d: Pick<AccountData, "weatherDays">, today: string) => d.weatherDays.filter((w) => w.start <= today && today <= (w.end || w.start)).length;

/** Chantiers en cours : une camionnette par chantier sur le parking. */
export const activeJobs = (d: Pick<AccountData, "jobs">) => d.jobs.filter((j) => j.status === "in_progress");

// ── Badges des pièces ────────────────────────────────────────────────────────

export function stockBadge({ data, can, t }: BadgeCtx): Badge | null {
  if (!can("stock")) return null;
  const n = lowStockCount(data);
  return { count: n, tone: n ? "danger" : "ok", text: n ? t(plural(n, "{n} article en stock bas", "{n} articles en stock bas"), { n }) : t("Stock au-dessus des minimums") };
}

export function officeBadge({ data, can, t }: BadgeCtx): Badge | null {
  const q = can("quotes") ? pendingQuotes(data).count : null;
  const f = can("invoices") ? openInvoices(data).length : null;
  if (q === null && f === null) return null;
  const parts = [
    q !== null && t(plural(q, "{n} devis en attente", "{n} devis en attente"), { n: q }),
    f !== null && t(plural(f, "{n} facture impayée", "{n} factures impayées"), { n: f }),
  ].filter(Boolean);
  const n = (q ?? 0) + (f ?? 0);
  return { count: n, tone: n ? "warning" : "ok", text: parts.join(" · ") };
}

export function timeBadge({ data, can, me, today, t }: BadgeCtx): Badge | null {
  const ids = clockedInToday(data, today);
  if (can("time")) {
    const n = ids.size;
    return { count: n, tone: n ? "ok" : "neutral", text: t(plural(n, "{n} personne pointée aujourd'hui", "{n} personnes pointées aujourd'hui"), { n }) };
  }
  // sans accès au pointage de l'équipe : uniquement sa propre présence
  if (me && can("worker")) {
    const mine = ids.has(me.id);
    return { count: mine ? 1 : 0, tone: mine ? "ok" : "neutral", text: mine ? t("Vous avez pointé aujourd'hui") : t("Pas encore pointé aujourd'hui") };
  }
  return null;
}

export function planningBadge({ data, can, today, t }: BadgeCtx): Badge | null {
  if (!can("planning")) return null;
  const late = lateJobsCount(data, today);
  const weather = weatherTodayCount(data, today);
  const parts = [
    late ? t(plural(late, "{n} chantier en retard", "{n} chantiers en retard"), { n: late }) : t("Aucun chantier en retard"),
    weather ? t("Intempéries en cours") : null,
  ].filter(Boolean);
  return { count: late + (weather ? 1 : 0), tone: late ? "danger" : weather ? "warning" : "ok", text: parts.join(" · ") };
}

export function parkingBadge({ data, can, t }: BadgeCtx): Badge | null {
  if (!can("jobs")) return null;
  const n = activeJobs(data).length;
  return { count: n, tone: "neutral", text: t(plural(n, "{n} chantier en cours", "{n} chantiers en cours"), { n }) };
}

/** Éléments visibles dans la scène (rayons en alerte, ouvriers, camionnettes…), selon les droits. */
export function sceneFacts(ctx: BadgeCtx) {
  const { data, can, today } = ctx;
  return {
    lowStock: can("stock") ? lowStockCount(data) : 0,
    workersIn: can("time") ? clockedInToday(data, today).size : 0,
    lateJobs: can("planning") ? lateJobsCount(data, today) : 0,
    weatherToday: can("planning") ? weatherTodayCount(data, today) > 0 : false,
    vans: can("jobs") ? activeJobs(data).length : 0,
    /** compte vide (nouveau) : message d'accueil */
    empty: !data.jobs.length && !data.docs.length && !data.timeEntries.length && !data.stockMoves.length,
  };
}
export type SceneFacts = ReturnType<typeof sceneFacts>;
