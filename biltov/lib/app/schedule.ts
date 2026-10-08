// Planning détaillé d'un chantier : phases, tâches, jalons, dépendances (fin→début, début→début avec délai),
// propagation des dates, chemin critique, alertes, création depuis un devis, décalage après intempérie.
// Les durées se comptent en jours ouvrables (sans week-ends, jours fériés belges ni congés du bâtiment)
// quand l'option est active (par défaut). Calculs purs : testés dans schedule.test.ts.

import { uid } from "./defaults";
import { addWorkdays, daysBetween, eachDay, isWorkday, plusDays, workdaysIn } from "./workdays";
import type { AccountData, Doc, Job, PlanningSettings, Task, TaskDep, WeatherDay } from "./types";

type Cal = PlanningSettings | undefined;
const workdaysOnly = (cal: Cal) => cal?.workdaysOnly !== false;

/** Durée d'une tâche (jours ouvrables ou calendaires selon le réglage, au moins 1). */
export const durationOf = (t: Pick<Task, "start" | "end">, cal: Cal) => (workdaysOnly(cal) ? Math.max(1, workdaysIn(t.start, t.end, cal).length) : daysBetween(t.start, t.end) + 1);

/** Fin d'une tâche de n jours commençant à `start` (premier jour ouvrable ≥ start). */
export function endFrom(start: string, n: number, cal: Cal) {
  if (!workdaysOnly(cal)) return plusDays(start, Math.max(1, n) - 1);
  return addWorkdays(addWorkdays(start, 0, cal), Math.max(1, n) - 1, cal);
}
const startOn = (day: string, cal: Cal) => (workdaysOnly(cal) ? addWorkdays(day, 0, cal) : day);
const shiftDays = (day: string, n: number, cal: Cal) => (workdaysOnly(cal) ? addWorkdays(day, n, cal) : plusDays(day, n));

export function newTask(p: Partial<Task> & Pick<Task, "jobId" | "name" | "start" | "end">): Task {
  return { id: uid(), parentId: null, kind: "task", progress: 0, ownerId: null, memberIds: [], vehicleIds: [], subcontractorId: null, status: "todo", notes: "", deps: [], materials: [], baseline: null, order: 0, sourceLineIds: [], ...p };
}

// ── Modèles de phases du bâtiment ────────────────────────────────────────────

export const PHASE_TEMPLATE: { name: string; days: number; milestone?: boolean }[] = [
  { name: "Installation de chantier", days: 2 },
  { name: "Gros œuvre", days: 15 },
  { name: "Toiture", days: 8 },
  { name: "Menuiseries extérieures", days: 5 },
  { name: "Électricité", days: 8 },
  { name: "Plomberie", days: 8 },
  { name: "Chauffage / HVAC", days: 6 },
  { name: "Plafonnage", days: 6 },
  { name: "Carrelage", days: 6 },
  { name: "Peinture", days: 6 },
  { name: "Finitions", days: 4 },
  { name: "Réception du chantier", days: 1, milestone: true },
];

/** Phases enchaînées (fin → début) à partir du début du chantier ; `names` limite le modèle. */
export function phasesFromTemplate(job: Job, cal: Cal, names = PHASE_TEMPLATE.map((p) => p.name), team = job.memberIds): Task[] {
  let cursor = startOn(job.startDate || new Date().toISOString().slice(0, 10), cal);
  const out: Task[] = [];
  PHASE_TEMPLATE.filter((p) => names.includes(p.name)).forEach((p, i) => {
    const end = p.milestone ? cursor : endFrom(cursor, p.days, cal);
    const prev = out[out.length - 1];
    out.push(newTask({ jobId: job.id, name: p.name, kind: p.milestone ? "milestone" : "task", start: cursor, end, order: i, memberIds: p.milestone ? [] : team, deps: prev ? [{ taskId: prev.id, type: "FS", lag: 0 }] : [] }));
    cursor = shiftDays(end, p.milestone ? 0 : 1, cal);
  });
  return out;
}

// ── Dépendances ──────────────────────────────────────────────────────────────

/** Date de début imposée par une dépendance. */
export function requiredStart(dep: TaskDep, pred: Task, cal: Cal) {
  if (dep.type === "SS") return shiftDays(startOn(pred.start, cal), dep.lag, cal);
  // fin → début : le jour (ouvrable) qui suit la fin, + délai (négatif = avance)
  return shiftDays(pred.end, (pred.kind === "milestone" ? 0 : 1) + dep.lag, cal);
}

const constraintOf = (t: Task, byId: Map<string, Task>, cal: Cal) => {
  let req: string | null = null;
  for (const d of t.deps) {
    const p = byId.get(d.taskId);
    if (!p) continue;
    const r = requiredStart(d, p, cal);
    if (!req || r > req) req = r;
  }
  return req;
};

/** Faire dépendre `from` de `to` créerait-il une boucle (`to` dépend déjà, même indirectement, de `from`) ? */
export function createsCycle(tasks: Task[], from: string, to: string) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const d of byId.get(id)?.deps ?? []) stack.push(d.taskId);
  }
  return false;
}

/** Ordre topologique (prédécesseurs d'abord) ; les boucles éventuelles sont ignorées. */
function topo(tasks: Task[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: Task[] = [];
  const state = new Map<string, number>();
  const visit = (t: Task) => {
    if (state.get(t.id) === 2 || state.get(t.id) === 1) return;
    state.set(t.id, 1);
    for (const d of t.deps) {
      const p = byId.get(d.taskId);
      if (p) visit(p);
    }
    state.set(t.id, 2);
    out.push(t);
  };
  tasks.forEach(visit);
  return out;
}

/**
 * Propage un changement : chaque tâche dépendante démarre au plus tôt à sa contrainte. Une tâche « collée » à
 * sa contrainte avant le changement suit aussi quand la tâche précédente avance (planning au plus tôt).
 * La durée de chaque tâche est conservée ; les phases sont ensuite recalculées.
 */
export function propagate(before: Task[], after: Task[], cal: Cal): Task[] {
  const oldById = new Map(before.map((t) => [t.id, t]));
  const prevMap = new Map(before.map((t) => [t.id, t]));
  const next = new Map(after.map((t) => [t.id, t]));
  for (const t0 of topo(after)) {
    const t = next.get(t0.id)!;
    if (!t.deps.length || t.kind === "phase") continue;
    const req = constraintOf(t, next, cal);
    if (!req) continue;
    const old = oldById.get(t.id);
    const oldReq = old ? constraintOf(old, prevMap, cal) : null;
    const tight = !!old && !!oldReq && old.start === oldReq && t.start === old.start;
    if (t.start < req || (tight && req !== t.start)) {
      const dur = durationOf(t, cal);
      const start = startOn(req, cal);
      next.set(t.id, { ...t, start, end: t.kind === "milestone" ? start : endFrom(start, dur, cal) });
    }
  }
  return rollupPhases([...next.values()]);
}

/** Les phases couvrent leurs tâches (début le plus tôt, fin la plus tard, avancement pondéré). */
export function rollupPhases(tasks: Task[]): Task[] {
  return tasks.map((p) => {
    if (p.kind !== "phase") return p;
    const kids = tasks.filter((t) => t.parentId === p.id && t.kind !== "phase");
    if (!kids.length) return p;
    const start = kids.map((k) => k.start).sort()[0];
    const end = kids.map((k) => k.end).sort().reverse()[0];
    const w = kids.reduce((s, k) => s + Math.max(1, daysBetween(k.start, k.end) + 1), 0);
    const progress = Math.round(kids.reduce((s, k) => s + Math.max(1, daysBetween(k.start, k.end) + 1) * (k.status === "done" ? 100 : k.progress), 0) / w);
    return { ...p, start, end, progress, status: kids.every((k) => k.status === "done") ? "done" : kids.some((k) => k.status !== "todo") ? "in_progress" : "todo" };
  });
}

/** Fin prévue du chantier = fin de la dernière tâche (null sans tâche). */
export const plannedEnd = (tasks: Task[]) => (tasks.length ? tasks.map((t) => t.end).sort().reverse()[0] : null);
export const plannedStart = (tasks: Task[]) => (tasks.length ? tasks.map((t) => t.start).sort()[0] : null);

/** Écart (jours ouvrables) entre la fin prévue et la fin contractuelle : > 0 = retard. */
export function endGap(end: string | null, contract: string | null | undefined, cal: Cal) {
  if (!end || !contract) return null;
  if (end === contract) return 0;
  const n = workdaysIn(end < contract ? end : contract, end < contract ? contract : end, cal).length - 1;
  return end > contract ? Math.max(1, n) : -Math.max(1, n);
}

// ── Chemin critique ──────────────────────────────────────────────────────────

/**
 * Tâches critiques : sans marge, un retard sur l'une d'elles retarde la fin du chantier.
 * Calcul « au plus tard » en jours ouvrables, à partir des dates actuelles.
 */
export function criticalPath(tasks: Task[], cal: Cal): Set<string> {
  const list = tasks.filter((t) => t.kind !== "phase");
  if (!list.length) return new Set();
  const from = list.map((t) => t.start).sort()[0];
  const to = list.map((t) => t.end).sort().reverse()[0];
  // numéro de jour ouvrable de chaque date de la période
  const days = eachDay(plusDays(from, -10), plusDays(to, 10));
  const ord = new Map<string, number>();
  let n = 0;
  for (const d of days) {
    if (!workdaysOnly(cal) || isWorkday(d, cal)) n++;
    ord.set(d, n);
  }
  const o = (d: string) => ord.get(d) ?? 0;
  const succ = new Map<string, { t: Task; dep: TaskDep }[]>();
  for (const t of list) for (const dep of t.deps) (succ.get(dep.taskId) ?? succ.set(dep.taskId, []).get(dep.taskId)!).push({ t, dep });
  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();
  const end = o(to);
  for (const t of topo(list).reverse()) {
    const dur = o(t.end) - o(t.start);
    let lf = end;
    for (const { t: s, dep } of succ.get(t.id) ?? []) {
      const ls = lateStart.get(s.id);
      if (ls === undefined) continue;
      lf = Math.min(lf, dep.type === "FS" ? ls - (t.kind === "milestone" ? 0 : 1) - dep.lag : ls - dep.lag + dur);
    }
    lateFinish.set(t.id, lf);
    lateStart.set(t.id, lf - dur);
  }
  return new Set(list.filter((t) => t.status !== "done" && (lateStart.get(t.id) ?? 0) - o(t.start) <= 0).map((t) => t.id));
}

// ── Alertes ──────────────────────────────────────────────────────────────────

export type TaskAlert = { taskId: string; kind: "late" | "dependency" | "double" | "offday" | "weather" | "stock"; text: string };

/** Stock disponible d'un article (tous dépôts et camionnettes). */
export const stockOf = (d: Pick<AccountData, "stockMoves">, articleId: string) => Math.round(d.stockMoves.filter((m) => m.articleId === articleId).reduce((s, m) => s + m.qty, 0) * 100) / 100;

export function taskAlerts(d: Pick<AccountData, "stockMoves" | "articles" | "weatherDays" | "members" | "settings">, tasks: Task[], today: string, conflictDays: (t: Task) => string[] = () => []): TaskAlert[] {
  const cal = d.settings.planning;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: TaskAlert[] = [];
  const fr = (iso: string) => iso.split("-").reverse().join("/");
  // besoins cumulés par article, par ordre de démarrage (stock consommé par les tâches précédentes)
  const need = new Map<string, number>();
  for (const t of [...tasks].sort((a, b) => a.start.localeCompare(b.start))) {
    if (t.kind === "phase") continue;
    if (t.status !== "done" && t.end < today) out.push({ taskId: t.id, kind: "late", text: `En retard : fin prévue le ${fr(t.end)}` });
    for (const dep of t.deps) {
      const p = byId.get(dep.taskId);
      if (p && t.start < requiredStart(dep, p, cal)) out.push({ taskId: t.id, kind: "dependency", text: `Dépendance non respectée : démarre avant « ${p.name} »` });
    }
    const dbl = conflictDays(t);
    if (dbl.length) out.push({ taskId: t.id, kind: "double", text: `Ouvrier réservé ailleurs : ${dbl.slice(0, 3).map(fr).join(", ")}${dbl.length > 3 ? "…" : ""}` });
    if (t.kind === "task" && workdaysOnly(cal) && (!isWorkday(t.start, cal) || !isWorkday(t.end, cal))) out.push({ taskId: t.id, kind: "offday", text: "Commence ou finit un jour non ouvrable (week-end, férié, congé)" });
    const wet = d.weatherDays.filter((w) => w.jobIds.includes(t.jobId) && w.start <= t.end && (w.end || w.start) >= t.start);
    if (wet.length && t.status !== "done") out.push({ taskId: t.id, kind: "weather", text: `Intempérie pendant la tâche : ${wet.map((w) => fr(w.start)).join(", ")}` });
    if (t.status === "todo") {
      for (const m of t.materials) {
        const total = (need.get(m.articleId) ?? 0) + m.qty;
        need.set(m.articleId, total);
        const have = stockOf(d, m.articleId);
        if (have < total) {
          const a = d.articles.find((x) => x.id === m.articleId);
          out.push({ taskId: t.id, kind: "stock", text: `Stock insuffisant avant le ${fr(t.start)} : ${a?.name.fr ?? "article"} (${have} / ${total} ${a?.unit ?? ""})` });
        }
      }
    }
  }
  return out;
}

// ── Devis → planning ─────────────────────────────────────────────────────────

/**
 * Propose des tâches à partir d'un devis accepté : un titre de section = une phase ; dans chaque phase, une tâche
 * pour nos équipes (durée = heures de main-d'œuvre ÷ (heures par jour × équipe), au moins 1 jour) et une tâche
 * externe par sous-traitant. Sans section : une phase « Travaux ». Tâches enchaînées fin → début.
 */
export function tasksFromQuote(doc: Doc, job: Job, cal: Cal, team = job.memberIds): Task[] {
  const hpd = cal?.hoursPerDay || 8;
  const groups: { title: string; lines: Doc["lines"] }[] = [];
  for (const l of doc.lines) {
    if (l.kind === "section") groups.push({ title: l.label || "Phase", lines: [] });
    else if (l.kind === "item" && (!l.optional || l.selected)) {
      if (!groups.length) groups.push({ title: "Travaux", lines: [] });
      groups[groups.length - 1].lines.push(l);
    }
  }
  let cursor = startOn(job.startDate || new Date().toISOString().slice(0, 10), cal);
  const out: Task[] = [];
  let order = 0;
  let prev: Task | null = null;
  for (const g of groups.filter((x) => x.lines.length)) {
    const own = g.lines.filter((l) => !l.executedBy);
    const hours = own.filter((l) => l.unit === "h").reduce((s, l) => s + l.qty, 0) + own.filter((l) => l.unit === "j").reduce((s, l) => s + l.qty * hpd, 0);
    const parts: { name: string; days: number; sub: string | null; lines: string[] }[] = [];
    if (own.length) parts.push({ name: `${g.title} — nos équipes`, days: Math.max(1, Math.ceil(hours / (hpd * Math.max(1, team.length)))), sub: null, lines: own.map((l) => l.id) });
    for (const sub of [...new Set(g.lines.map((l) => l.executedBy).filter(Boolean) as string[])]) {
      const ls = g.lines.filter((l) => l.executedBy === sub);
      const h = ls.filter((l) => l.unit === "h").reduce((s, l) => s + l.qty, 0);
      parts.push({ name: `${g.title} — sous-traitance`, days: Math.max(1, Math.ceil(h / hpd) || 2), sub, lines: ls.map((l) => l.id) });
    }
    // une phase seulement si la section mêle nos équipes et des sous-traitants (sinon : une tâche au nom de la section)
    const phase = parts.length > 1 ? newTask({ jobId: job.id, name: g.title, kind: "phase", start: cursor, end: cursor, order: order++, sourceLineIds: g.lines.map((l) => l.id) }) : null;
    if (phase) out.push(phase);
    for (const p of parts) {
      const end = endFrom(cursor, p.days, cal);
      const t: Task = newTask({ jobId: job.id, parentId: phase?.id ?? null, name: parts.length > 1 ? p.name : g.title, start: cursor, end, order: order++, memberIds: p.sub ? [] : team, subcontractorId: p.sub, sourceLineIds: p.lines, deps: prev ? [{ taskId: prev.id, type: "FS", lag: 0 }] : [] });
      out.push(t);
      prev = t;
      cursor = shiftDays(end, 1, cal);
    }
  }
  return rollupPhases(out);
}

// ── Intempéries ──────────────────────────────────────────────────────────────

/**
 * Décalage proposé après une intempérie : les tâches non terminées qui couvrent les jours touchés sont repoussées
 * de `days` jours ouvrables, puis les dépendances suivent.
 */
export function shiftForWeather(tasks: Task[], w: Pick<WeatherDay, "start" | "end">, days: number, cal: Cal): { tasks: Task[]; moved: Task[] } {
  if (days <= 0) return { tasks, moved: [] };
  const hit = tasks.filter((t) => t.kind !== "phase" && t.status !== "done" && t.start <= (w.end || w.start) && t.end >= w.start);
  if (!hit.length) return { tasks, moved: [] };
  const ids = new Set(hit.map((t) => t.id));
  // la tâche touchée s'allonge (elle a perdu des jours) : sa fin recule
  const after = tasks.map((t) => (ids.has(t.id) ? { ...t, end: shiftDays(t.end, days, cal) } : t));
  const next = propagate(tasks, after, cal);
  const before = new Map(tasks.map((t) => [t.id, t]));
  return { tasks: next, moved: next.filter((t) => t.kind !== "phase" && (before.get(t.id)?.start !== t.start || before.get(t.id)?.end !== t.end)) };
}

/** Heures pointées sur une tâche, et heures prévues (jours × heures par jour × équipe). */
export function taskHours(d: Pick<AccountData, "timeEntries" | "settings">, t: Task) {
  const done = d.timeEntries.filter((e) => e.taskId === t.id).reduce((s, e) => s + e.hours, 0);
  const planned = durationOf(t, d.settings.planning) * (d.settings.planning?.hoursPerDay || 8) * Math.max(1, t.memberIds.length);
  return { done: Math.round(done * 10) / 10, planned };
}
