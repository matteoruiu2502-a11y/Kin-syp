// Planning Gantt : état des chantiers, affectations des ressources jour par jour, conflits
// (même ouvrier ou véhicule sur deux chantiers le même jour), charge de travail par semaine.
// Calculs purs, sans React : testés dans gantt.test.ts.

import { eachDay, isWorkday, plusDays, weekday, workdaysIn } from "./workdays";
import type { AccountData, Job, PlanningSettings, Task } from "./types";

type Cal = PlanningSettings | undefined;
export type JobState = "upcoming" | "ongoing" | "risk" | "late" | "done";
export const JOB_STATE_LABEL: Record<JobState, string> = { upcoming: "À venir", ongoing: "En cours", risk: "À risque", late: "En retard", done: "Terminé" };

/** Chantiers signés, affichés dans le planning. */
export const plannedJobs = (d: Pick<AccountData, "jobs">) => d.jobs.filter((j) => j.status === "accepted" || j.status === "in_progress" || j.status === "done");

export const isScheduled = (j: Job) => !!j.startDate && !!j.endDate && j.endDate >= j.startDate;

/** Avancement (%) pondéré par la durée des tâches ; null si le chantier n'a pas de tâche. */
export function jobProgress(d: Pick<AccountData, "tasks" | "settings">, job: Job): number | null {
  if (job.status === "done") return 100;
  const tasks = d.tasks.filter((t) => t.jobId === job.id && t.kind === "task");
  if (!tasks.length) return null;
  let w = 0;
  let sum = 0;
  for (const t of tasks) {
    const days = Math.max(1, workdaysIn(t.start, t.end, d.settings.planning).length);
    w += days;
    sum += days * (t.status === "done" ? 100 : t.progress);
  }
  return Math.round(sum / w);
}

/**
 * État affiché d'un chantier : terminé, en retard (fin prévue dépassée), à risque (la fin prévue dépasse la fin
 * contractuelle, ou une tâche est en retard), à venir, en cours.
 */
export function jobState(d: Pick<AccountData, "tasks">, job: Job, today: string): JobState {
  if (job.status === "done") return "done";
  if (job.endDate && job.endDate < today) return "late";
  const lateTask = d.tasks.some((t) => t.jobId === job.id && t.kind !== "phase" && t.status !== "done" && t.end < today);
  if ((job.contractEndDate && job.endDate && job.endDate > job.contractEndDate) || lateTask) return "risk";
  if (!job.startDate || job.startDate > today) return "upcoming";
  return "ongoing";
}

/** Chantiers signés « à planifier » : sans dates, ou sans personne affectée (ni à l'équipe, ni aux tâches). */
export function unscheduledJobs(d: Pick<AccountData, "jobs" | "tasks">) {
  return plannedJobs(d)
    .filter((j) => j.status !== "done")
    .filter((j) => !isScheduled(j) || (!j.memberIds.length && !d.tasks.some((t) => t.jobId === j.id && t.memberIds.length)));
}

// ── Affectations et conflits ────────────────────────────────────────────────

export type Assignment = { day: string; resource: string; jobId: string; source: "task" | "job" | "event"; label: string };
export const LEAVE = "__leave";

/**
 * Qui travaille où, jour par jour (jours ouvrables). Sources : tâches (ouvriers, véhicules), équipe du chantier
 * quand aucune tâche n'affecte de personne, interventions de l'agenda ; un congé occupe aussi la personne.
 * Ressource : « m:<id> » (ouvrier) ou « v:<id> » (véhicule).
 */
export function assignments(d: Pick<AccountData, "jobs" | "tasks" | "events" | "settings">, from: string, to: string): Assignment[] {
  const cal = d.settings.planning;
  const out: Assignment[] = [];
  const clip = (a: string, b: string) => [a > from ? a : from, b < to ? b : to] as const;
  const days = (a: string, b: string) => {
    const [x, y] = clip(a, b);
    return x <= y ? eachDay(x, y).filter((day) => isWorkday(day, cal)) : [];
  };
  const active = plannedJobs(d).filter((j) => j.status !== "done");
  const activeIds = new Set(active.map((j) => j.id));
  for (const t of d.tasks) {
    if (t.kind !== "task" || t.status === "done" || !activeIds.has(t.jobId) || !(t.memberIds.length || t.vehicleIds.length)) continue;
    for (const day of days(t.start, t.end)) {
      for (const m of t.memberIds) out.push({ day, resource: `m:${m}`, jobId: t.jobId, source: "task", label: t.name });
      for (const v of t.vehicleIds) out.push({ day, resource: `v:${v}`, jobId: t.jobId, source: "task", label: t.name });
    }
  }
  const staffedByTasks = new Set(d.tasks.filter((t) => t.kind === "task" && t.memberIds.length).map((t) => t.jobId));
  for (const j of active) {
    if (!isScheduled(j) || staffedByTasks.has(j.id)) continue;
    for (const day of days(j.startDate, j.endDate)) for (const m of j.memberIds) out.push({ day, resource: `m:${m}`, jobId: j.id, source: "job", label: j.name });
  }
  for (const e of d.events) {
    if (e.status === "cancelled" || e.status === "refused" || e.status === "requested") continue;
    const jobId = e.kind === "leave" ? LEAVE : e.jobId;
    if (!jobId || (jobId !== LEAVE && !activeIds.has(jobId))) continue;
    for (const day of days(e.start.slice(0, 10), e.end.slice(0, 10))) {
      for (const m of e.memberIds) out.push({ day, resource: `m:${m}`, jobId, source: "event", label: e.title });
      for (const v of e.vehicleIds ?? []) out.push({ day, resource: `v:${v}`, jobId, source: "event", label: e.title });
    }
  }
  return out;
}

export type Conflict = { id: string; resource: string; from: string; to: string; days: string[]; jobIds: string[] };

/** Conflits : une ressource sur au moins deux chantiers (ou chantier + congé) le même jour, regroupés en périodes. */
export function findConflicts(list: Assignment[], cal: Cal): Conflict[] {
  const byKey = new Map<string, Set<string>>();
  for (const a of list) {
    const k = `${a.resource}|${a.day}`;
    (byKey.get(k) ?? byKey.set(k, new Set()).get(k)!).add(a.jobId);
  }
  const hits = [...byKey]
    .filter(([, jobs]) => jobs.size > 1)
    .map(([k, jobs]) => {
      const [resource, day] = k.split("|");
      return { resource, day, jobs: [...jobs].sort() };
    })
    .sort((a, b) => a.resource.localeCompare(b.resource) || a.jobs.join().localeCompare(b.jobs.join()) || a.day.localeCompare(b.day));
  const out: Conflict[] = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    // même ressource, mêmes chantiers, jour ouvrable suivant : on prolonge la période
    if (last && last.resource === h.resource && last.jobIds.join() === h.jobs.join() && nextWorkday(last.to, cal) === h.day) {
      last.to = h.day;
      last.days.push(h.day);
    } else out.push({ id: `${h.resource}|${h.jobs.join("+")}|${h.day}`, resource: h.resource, from: h.day, to: h.day, days: [h.day], jobIds: h.jobs });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

const nextWorkday = (day: string, cal: Cal) => {
  let x = plusDays(day, 1);
  for (let i = 0; i < 40 && !isWorkday(x, cal); i++) x = plusDays(x, 1);
  return x;
};

/** Chantiers dont les périodes se chevauchent (indication visuelle, sans être un conflit). */
export function overlaps(jobs: Job[]) {
  const out = new Map<string, string[]>();
  const s = jobs.filter(isScheduled);
  for (const a of s) out.set(a.id, s.filter((b) => b.id !== a.id && a.startDate <= b.endDate && b.startDate <= a.endDate).map((b) => b.id));
  return out;
}

// ── Charge de travail ────────────────────────────────────────────────────────

export type WeekLoad = { week: string; needed: number; available: number };

/**
 * Par semaine (lundi) : pic d'ouvriers nécessaires un même jour, et ouvriers disponibles ce jour-là
 * (ouvriers et employés actifs, moins ceux en congé).
 */
export function weeklyLoad(d: Pick<AccountData, "jobs" | "tasks" | "events" | "settings" | "members">, from: string, to: string, list = assignments(d, from, to)): WeekLoad[] {
  const cal = d.settings.planning;
  const staff = d.members.filter((m) => m.active && (m.role === "worker" || m.role === "employee")).map((m) => `m:${m.id}`);
  const busy = new Map<string, Set<string>>(); // jour → ouvriers sur chantier
  const leave = new Map<string, Set<string>>(); // jour → ouvriers en congé
  for (const a of list) {
    if (!a.resource.startsWith("m:")) continue;
    const map = a.jobId === LEAVE ? leave : busy;
    (map.get(a.day) ?? map.set(a.day, new Set()).get(a.day)!).add(a.resource);
  }
  const out: WeekLoad[] = [];
  for (let mon = plusDays(from, -weekday(from)); mon <= to; mon = plusDays(mon, 7)) {
    const days = eachDay(mon, plusDays(mon, 4)).filter((x) => isWorkday(x, cal));
    if (!days.length) {
      out.push({ week: mon, needed: 0, available: 0 });
      continue;
    }
    const needed = Math.max(0, ...days.map((x) => [...(busy.get(x) ?? [])].filter((r) => !leave.get(x)?.has(r)).length));
    const available = Math.min(...days.map((x) => staff.filter((r) => !leave.get(x)?.has(r)).length));
    out.push({ week: mon, needed, available });
  }
  return out;
}

/** Période affichée par défaut : du plus ancien début (au plus 1 mois avant aujourd'hui) à la plus lointaine fin. */
export function defaultRange(jobs: Job[], tasks: Task[], today: string) {
  const s = jobs.filter(isScheduled);
  const starts = [...s.map((j) => j.startDate), ...tasks.map((t) => t.start)].filter(Boolean).sort();
  const ends = [...s.map((j) => j.endDate), ...tasks.map((t) => t.end)].filter(Boolean).sort();
  const min = plusDays(today, -30);
  const from = starts[0] && starts[0] > min ? starts[0] : min;
  const to = ends.length && ends[ends.length - 1] > plusDays(today, 60) ? ends[ends.length - 1] : plusDays(today, 60);
  return { from: plusDays(from, -weekday(from)), to: to > plusDays(today, 730) ? plusDays(today, 730) : to };
}
