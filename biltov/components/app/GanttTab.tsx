"use client";

// Planning « grande maille » : une ligne par chantier sur une frise (jour / semaine / mois / trimestre),
// chevauchements, conflits de ressources, charge de travail par semaine, chantiers à planifier.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Clock, CloudRain, Crosshair, FileText, Image as ImageIcon, Loader2, Move, Undo2, type LucideIcon } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { useI18n } from "@/lib/i18n";
import { todayIso } from "@/lib/app/defaults";
import { cn } from "@/lib/utils";
import { JOB_STATE_LABEL, LEAVE, assignments, defaultRange, findConflicts, isScheduled, jobProgress, jobState, overlaps, plannedJobs, unscheduledJobs, weeklyLoad, type Conflict, type JobState } from "@/lib/app/gantt";
import { addWorkdays, dayOff, daysBetween, eachDay, plusDays, weekday, workdaysIn } from "@/lib/app/workdays";
import { placeOf } from "@/lib/app/weather";
import type { Job, Task } from "@/lib/app/types";
import { Field, Modal, Notice, inputClass } from "./ui";

export type Zoom = "day" | "week" | "month" | "quarter";
export const PX: Record<Zoom, number> = { day: 40, week: 18, month: 5, quarter: 1.8 };

/** État : couleur réservée au statut + icône + libellé. */
export const STATE_STYLE: Record<JobState, { bar: string; pill: string; icon: LucideIcon }> = {
  upcoming: { bar: "bg-slate-500/30 ring-1 ring-inset ring-slate-400/50", pill: "border-white/10 text-slate-300", icon: Clock },
  ongoing: { bar: "bg-blue", pill: "border-blue/40 bg-blue/10 text-cyan", icon: CircleDot },
  risk: { bar: "bg-amber-400", pill: "border-amber-400/40 bg-amber-400/10 text-amber-300", icon: AlertTriangle },
  late: { bar: "bg-rose-500", pill: "border-rose-400/40 bg-rose-400/10 text-rose-300", icon: CalendarClock },
  done: { bar: "bg-emerald-500", pill: "border-emerald/40 bg-emerald/10 text-emerald", icon: CheckCircle2 },
};

/** Numéro de semaine ISO 8601 (semaine commençant le lundi). */
export function isoWeek(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - y.getTime()) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7);
}

function useMedia(query: string) {
  const [hit, setHit] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setHit(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return hit;
}

type Filters = { state: JobState | ""; manager: string; client: string; city: string; trade: string };
type Drag = { jobId: string; mode: "move" | "end"; x0: number; delta: number };

export function GanttTab() {
  const { t } = useTr();
  const f = useFmt();
  const { t: land } = useI18n();
  const { data, can, update } = useAppData();
  const narrow = useMedia("(max-width: 639px)");
  const medium = useMedia("(max-width: 1279px)");
  const touch = useMedia("(pointer: coarse)");
  const today = todayIso();
  const cal = data.settings.planning;
  const canMove = can("planning", "edit") && can("jobs", "edit");
  const [zoom, setZoom] = useState<Zoom>("week");
  const [filters, setFilters] = useState<Filters>({ state: "", manager: "", client: "", city: "", trade: "" });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showConflicts, setShowConflicts] = useState(false);
  const [focus, setFocus] = useState<Conflict | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [moveMode, setMoveMode] = useState(false); // tactile : déplacer les barres au doigt
  const [undo, setUndo] = useState<{ label: string; jobs: Job[]; tasks: Task[] } | null>(null);
  const [scheduling, setScheduling] = useState<{ job: Job; day: string } | null>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "png">("");
  const [showFilters, setShowFilters] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const px = PX[zoom];
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const LEFT = narrow ? 150 : medium ? 210 : 280;
  const all = plannedJobs(data);
  const cities = useMemo(() => [...new Set(all.map((j) => placeOf(j, data).city).filter(Boolean))].sort(), [all, data]);
  const jobs = all
    .filter(isScheduled)
    .filter((j) => !filters.state || jobState(data, j, today) === filters.state)
    .filter((j) => !filters.manager || j.managerId === filters.manager)
    .filter((j) => !filters.client || j.clientId === filters.client)
    .filter((j) => !filters.city || placeOf(j, data).city === filters.city)
    .filter((j) => !filters.trade || j.trade === filters.trade)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  const { from, to } = useMemo(() => defaultRange(all, data.tasks, today), [all, data.tasks, today]);
  const days = useMemo(() => eachDay(from, to), [from, to]);
  const W = days.length * px;
  const x = (day: string) => daysBetween(from, day) * px;

  const assign = useMemo(() => assignments(data, from, to), [data, from, to]);
  const conflicts = useMemo(() => findConflicts(assign, cal), [assign, cal]);
  const load = useMemo(() => weeklyLoad(data, from, to, assign), [data, from, to, assign]);
  const over = useMemo(() => overlaps(jobs), [jobs]);
  const toPlan = unscheduledJobs(data);
  const resName = (r: string) => (r.startsWith("m:") ? data.members.find((m) => m.id === r.slice(2))?.name : data.vehicles.find((v) => v.id === r.slice(2))?.plate) ?? "?";
  const jobName = (id: string) => (id === LEAVE ? t("Congé") : (data.jobs.find((j) => j.id === id)?.name ?? "?"));
  const conflictDays = (jobId: string, resource?: string) => new Set(conflicts.filter((c) => c.jobIds.includes(jobId) && (!resource || c.resource === resource)).flatMap((c) => c.days));

  const scrollTo = (day: string) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.max(0, x(day) - (el.clientWidth - LEFT) / 3), behavior: "smooth" });
  };
  useEffect(() => {
    scrollTo(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const goConflict = (c: Conflict) => {
    setFocus(c);
    setOpen((s) => new Set([...s, ...c.jobIds]));
    scrollTo(c.from);
  };

  // ── Glisser une barre : déplacer le chantier (et ses tâches) ou allonger sa fin ──
  const onDown = (e: RPointerEvent, job: Job, mode: Drag["mode"]) => {
    if (!canMove || (e.pointerType !== "mouse" && !moveMode)) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ jobId: job.id, mode, x0: e.clientX, delta: 0 });
  };
  const onMove = (e: RPointerEvent) => drag && setDrag({ ...drag, delta: Math.round((e.clientX - drag.x0) / px) });
  const onUp = () => {
    if (!drag) return;
    const job = data.jobs.find((j) => j.id === drag.jobId);
    setDrag(null);
    if (!job || !drag.delta) return;
    const before = { jobs: [job], tasks: data.tasks.filter((tk) => tk.jobId === job.id) };
    const shift = (s: string) => plusDays(s, drag.delta);
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) => (j.id !== job.id ? j : drag.mode === "move" ? { ...j, startDate: shift(j.startDate), endDate: shift(j.endDate) } : { ...j, endDate: shift(j.endDate) < j.startDate ? j.startDate : shift(j.endDate) })),
      tasks: drag.mode === "move" ? d.tasks.map((tk) => (tk.jobId === job.id ? { ...tk, start: shift(tk.start), end: shift(tk.end) } : tk)) : d.tasks,
    }));
    setUndo({ label: drag.mode === "move" ? t("« {job} » déplacé de {n} jour(s).", { job: job.name, n: drag.delta }) : t("Fin de « {job} » modifiée.", { job: job.name }), ...before });
  };
  const doUndo = () => {
    if (!undo) return;
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) => undo.jobs.find((u) => u.id === j.id) ?? j),
      tasks: d.tasks.map((tk) => undo.tasks.find((u) => u.id === tk.id) ?? tk),
    }));
    setUndo(null);
  };

  const exportAs = async (kind: "pdf" | "png") => {
    setBusy(kind);
    try {
      const { exportGlobalGantt } = await import("@/lib/app/ganttExport");
      await exportGlobalGantt(kind, { data, jobs, from, to, today, conflicts, load });
    } finally {
      setBusy("");
    }
  };

  // ── En-tête de la frise ──
  const months = useMemo(() => {
    const out: { key: string; x: number; w: number; label: string }[] = [];
    for (const d of days) {
      if (d === days[0] || d.endsWith("-01")) out.push({ key: d, x: x(d), w: 0, label: new Date(`${d}T12:00:00Z`).toLocaleDateString(f.locale, { month: px < 3 ? "short" : "long", year: "numeric" }) });
    }
    out.forEach((m, i) => (m.w = (out[i + 1]?.x ?? W) - m.x));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, px, f.locale]);
  const offDays = useMemo(() => days.map((d) => ({ d, off: dayOff(d, cal) })).filter((o) => o.off && !(zoom === "quarter" && o.off.kind === "weekend")), [days, cal, zoom]);

  const ROW = 52;
  const SUB = 34;
  const visibleRows: { kind: "job" | "task" | "member"; job: Job; task?: Task; memberId?: string }[] = [];
  for (const j of jobs) {
    visibleRows.push({ kind: "job", job: j });
    if (!open.has(j.id)) continue;
    const tasks = data.tasks.filter((tk) => tk.jobId === j.id).sort((a, b) => a.order - b.order || a.start.localeCompare(b.start));
    if (tasks.length) tasks.forEach((tk) => visibleRows.push({ kind: "task", job: j, task: tk }));
    else j.memberIds.forEach((m) => visibleRows.push({ kind: "member", job: j, memberId: m }));
  }
  const bodyH = visibleRows.reduce((s, r) => s + (r.kind === "job" ? ROW : SUB), 0);
  const maxLoad = Math.max(1, ...load.map((l) => Math.max(l.needed, l.available)));

  return (
    <div>
      {conflicts.length > 0 && (
        <button onClick={() => setShowConflicts(!showConflicts)} className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-left text-sm font-semibold text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("{n} conflit(s) à résoudre", { n: conflicts.length })}</span>
          {showConflicts ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
      {showConflicts && (
        <ul className="mb-4 space-y-2">
          {conflicts.map((c) => (
            <li key={c.id}>
              <button onClick={() => goConflict(c)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm", focus?.id === c.id ? "border-rose-400/60 bg-rose-400/10" : "border-white/10 hover:bg-white/[0.04]")}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-white">{resName(c.resource)}</span>{" "}
                  <span className="text-slate-400">
                    {c.from === c.to ? t("le {date}", { date: f.date(c.from) }) : t("du {from} au {to}", { from: f.date(c.from), to: f.date(c.to) })} ({t("{n} jour(s)", { n: c.days.length })})
                  </span>
                  <span className="block text-slate-300">{c.jobIds.map(jobName).join(" ⟷ ")}</span>
                </span>
                <Crosshair className="h-4 w-4 shrink-0 text-slate-400" aria-label={t("Voir sur la frise")} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {(["day", "week", "month", "quarter"] as const).map((z) => (
            <button key={z} role="tab" aria-selected={zoom === z} onClick={() => setZoom(z)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold", zoom === z ? "bg-blue text-white" : "text-slate-400 hover:text-white")}>
              {t({ day: "Jour", week: "Semaine", month: "Mois", quarter: "Trimestre" }[z])}
            </button>
          ))}
        </div>
        <button onClick={() => scrollTo(today)} className="btn-ghost !py-2.5 text-sm">
          {t("Aujourd'hui")}
        </button>
        {canMove && touch && (
          <button onClick={() => setMoveMode(!moveMode)} aria-pressed={moveMode} className={cn("btn-ghost !py-2.5 text-sm", moveMode && "!border-blue !text-cyan")}>
            <Move className="h-4 w-4" /> {t("Déplacer")}
          </button>
        )}
        <div className="flex gap-2 sm:ml-auto">
          <button onClick={() => exportAs("pdf")} disabled={!!busy} className="btn-ghost !py-2.5 text-sm">
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </button>
          <button onClick={() => exportAs("png")} disabled={!!busy} className="btn-ghost !py-2.5 text-sm">
            {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} {t("Image")}
          </button>
        </div>
      </div>

      <button onClick={() => setShowFilters(!showFilters)} className="btn-ghost mb-3 w-full !py-2.5 text-sm sm:hidden" aria-expanded={showFilters}>
        {t("Filtres")}
        {activeFilters > 0 && ` (${activeFilters})`} {showFilters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      <div className={cn("mb-3 grid-cols-2 gap-2 sm:grid lg:grid-cols-5", showFilters ? "grid" : "hidden")}>
        <select value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value as JobState | "" })} className={inputClass} aria-label={t("Statut")}>
          <option value="">{t("Tous les statuts")}</option>
          {(Object.keys(JOB_STATE_LABEL) as JobState[]).map((s) => (
            <option key={s} value={s}>
              {t(JOB_STATE_LABEL[s])}
            </option>
          ))}
        </select>
        <select value={filters.manager} onChange={(e) => setFilters({ ...filters, manager: e.target.value })} className={inputClass} aria-label={t("Responsable")}>
          <option value="">{t("Tous les responsables")}</option>
          {data.members
            .filter((m) => all.some((j) => j.managerId === m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <select value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })} className={inputClass} aria-label={t("Client")}>
          <option value="">{t("Tous les clients")}</option>
          {data.clients
            .filter((c) => all.some((j) => j.clientId === c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <select value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} className={inputClass} aria-label={t("Commune")}>
          <option value="">{t("Toutes les communes")}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={filters.trade} onChange={(e) => setFilters({ ...filters, trade: e.target.value })} className={cn(inputClass, "col-span-2 lg:col-span-1")} aria-label={t("Corps de métier")}>
          <option value="">{t("Tous les corps de métier")}</option>
          {land.trades.list
            .filter((tr) => all.some((j) => j.trade === tr.id))
            .map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
        </select>
      </div>

      {undo && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
          <span className="flex-1">{undo.label}</span>
          <button onClick={doUndo} className="flex items-center gap-1 font-semibold text-cyan">
            <Undo2 className="h-4 w-4" /> {t("Annuler")}
          </button>
        </div>
      )}
      {moveMode && <Notice>{t("Mode déplacement : faites glisser une barre pour décaler le chantier, ou sa poignée droite pour changer la fin.")}</Notice>}

      {jobs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
          {all.length ? t("Aucun chantier ne correspond aux filtres.") : t("Aucun chantier signé avec des dates. Planifiez un chantier ci-dessous ou depuis sa fiche.")}
        </p>
      ) : (
        <div className="card overflow-hidden !rounded-2xl">
          <div ref={scroller} className="relative max-h-[70vh] overflow-auto overscroll-x-contain" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
            <div className="relative" style={{ width: LEFT + W }}>
              {/* En-tête : mois + jours / semaines */}
              <div className="sticky top-0 z-20 flex border-b border-white/10 bg-[var(--card)]">
                <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-white/10 bg-[var(--card)] px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400" style={{ width: LEFT }}>
                  {t("Chantier")}
                </div>
                <div className="relative h-12 shrink-0" style={{ width: W }}>
                  {months.map((m) => (
                    <div key={m.key} className="absolute top-0 truncate border-l border-white/10 px-2 pt-1 text-xs font-semibold capitalize text-slate-300" style={{ left: m.x, width: m.w }}>
                      {m.label}
                    </div>
                  ))}
                  {zoom === "day" &&
                    days.map((d) => (
                      <div key={d} className={cn("absolute bottom-0 text-center text-[10px]", d === today ? "font-bold text-cyan" : "text-slate-500")} style={{ left: x(d), width: px }}>
                        {Number(d.slice(8))}
                      </div>
                    ))}
                  {zoom === "week" &&
                    days
                      .filter((d) => weekday(d) === 0)
                      .map((d) => (
                        <div key={d} className="absolute bottom-0 border-l border-white/5 pl-1 text-[10px] text-slate-500" style={{ left: x(d), width: 7 * px }}>
                          {t("S{n}", { n: isoWeek(d) })}
                        </div>
                      ))}
                </div>
              </div>

              {/* Fond : week-ends, jours fériés, congés, aujourd'hui */}
              <div className="pointer-events-none absolute z-0" style={{ left: LEFT, top: 48, width: W, height: bodyH }}>
                {offDays.map(({ d, off }) => (
                  <div
                    key={d}
                    title={off!.label}
                    className={cn(
                      "absolute top-0 h-full",
                      off!.kind === "weekend" ? "bg-[repeating-linear-gradient(135deg,rgb(148_163_184/0.10)_0_3px,transparent_3px_6px)]" : off!.kind === "holiday" ? "bg-slate-400/15" : "bg-blue/[0.08]",
                    )}
                    style={{ left: x(d), width: Math.max(px, 1) }}
                  />
                ))}
                {focus && <div className="absolute top-0 h-full bg-rose-400/15 ring-1 ring-inset ring-rose-400/50" style={{ left: x(focus.from), width: (daysBetween(focus.from, focus.to) + 1) * px }} />}
                {today >= from && today <= to && <div className="absolute top-0 h-full w-0.5 bg-blue" style={{ left: x(today) + px / 2 }} aria-hidden />}
              </div>

              {/* Lignes */}
              {visibleRows.map((r, i) => {
                if (r.kind === "job") {
                  const j = r.job;
                  const st = jobState(data, j, today);
                  const S = STATE_STYLE[st];
                  const prog = jobProgress(data, j);
                  const d = drag?.jobId === j.id ? drag : null;
                  const s = d?.mode === "move" ? plusDays(j.startDate, d.delta) : j.startDate;
                  let e = d ? plusDays(j.endDate, d.delta) : j.endDate;
                  if (e < s) e = s;
                  const bx = x(s);
                  const bw = (daysBetween(s, e) + 1) * px;
                  const cdays = conflictDays(j.id);
                  const wdays = data.weatherDays.filter((w) => w.jobIds.includes(j.id));
                  const client = data.clients.find((c) => c.id === j.clientId);
                  const ov = over.get(j.id)?.length ?? 0;
                  const hl = focus?.jobIds.includes(j.id);
                  return (
                    <div key={j.id} className={cn("relative flex border-b border-white/5", hl && "bg-rose-400/[0.06]")} style={{ height: ROW }}>
                      <button onClick={() => setOpen((o) => (o.has(j.id) ? new Set([...o].filter((x) => x !== j.id)) : new Set([...o, j.id])))} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-white/10 bg-[var(--card)] px-2 text-left" style={{ width: LEFT }} aria-expanded={open.has(j.id)}>
                        {open.has(j.id) ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white" title={j.name}>
                            {j.name}
                          </span>
                          <span className="flex items-center gap-1 truncate text-[11px] text-slate-400">
                            <S.icon className="h-3 w-3 shrink-0" aria-hidden /> {t(JOB_STATE_LABEL[st])}
                            {!narrow && client && ` · ${client.name}`}
                            {!narrow && ov > 0 && ` · ${t("chevauche {n}", { n: ov })}`}
                          </span>
                        </span>
                      </button>
                      <div className="relative shrink-0" style={{ width: W }}>
                        {wdays.flatMap((w) =>
                          eachDay(w.start, w.end || w.start)
                            .filter((day) => day >= from && day <= to)
                            .map((day) => (
                              <div key={w.id + day} title={t("Intempérie")} className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,rgb(29_78_216/0.22)_0_2px,transparent_2px_5px)]" style={{ left: x(day), width: Math.max(px, 2) }} />
                            )),
                        )}
                        <div
                          role="img"
                          aria-label={`${j.name} : ${f.date(j.startDate)} → ${f.date(j.endDate)}, ${t(JOB_STATE_LABEL[st])}${prog !== null ? `, ${prog} %` : ""}${cdays.size ? `, ${t("{n} conflit(s)", { n: cdays.size })}` : ""}`}
                          title={`${j.name}\n${f.date(j.startDate)} → ${f.date(j.endDate)}${prog !== null ? `\n${prog} %` : ""}`}
                          onPointerDown={(ev) => onDown(ev, j, "move")}
                          className={cn("absolute top-3 flex h-6 items-center overflow-hidden rounded-md text-[11px] font-semibold text-white shadow-sm", S.bar, st === "upcoming" && "text-slate-200", canMove && "cursor-grab active:cursor-grabbing", d && "opacity-80 ring-2 ring-blue")}
                          style={{ left: bx, width: Math.max(bw, 4), touchAction: moveMode ? "none" : "auto" }}
                        >
                          {prog !== null && prog > 0 && <span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${prog}%` }} />}
                          {bw > 60 && <span className="relative truncate px-2">{prog !== null ? `${prog} %` : ""}</span>}
                          {canMove && <span onPointerDown={(ev) => (ev.stopPropagation(), onDown(ev, j, "end"))} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/30" aria-hidden />}
                        </div>
                        {[...cdays].filter((day) => day >= from && day <= to).map((day) => (
                          <span key={day} className="absolute bottom-1 h-1.5 rounded-full bg-rose-500" style={{ left: x(day), width: Math.max(px - 1, 2) }} title={t("Conflit")} />
                        ))}
                        {wdays.length > 0 && px >= 14 && wdays.slice(0, 20).map((w) => (
                          <CloudRain key={w.id} className="absolute bottom-0.5 h-3 w-3 text-cyan" style={{ left: x(w.start) + px / 2 - 6 }} aria-label={t("Intempérie")} />
                        ))}
                      </div>
                    </div>
                  );
                }
                // sous-lignes : tâches du chantier, sinon membres de l'équipe
                const j = r.job;
                const tk = r.task;
                const name = tk ? tk.name : (data.members.find((m) => m.id === r.memberId)?.name ?? "?");
                const s = tk ? tk.start : j.startDate;
                const e = tk ? tk.end : j.endDate;
                const cdays = r.memberId ? conflictDays(j.id, `m:${r.memberId}`) : tk ? new Set(tk.memberIds.flatMap((m) => [...conflictDays(j.id, `m:${m}`)]).filter((day) => day >= tk.start && day <= tk.end)) : new Set<string>();
                return (
                  <div key={`${j.id}-${tk?.id ?? r.memberId}-${i}`} className="relative flex border-b border-white/5" style={{ height: SUB }}>
                    <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-white/10 bg-[var(--card)] pl-8 pr-2 text-xs text-slate-300" style={{ width: LEFT }}>
                      <span className={cn("truncate", tk?.kind === "phase" && "font-semibold text-white")} title={name}>
                        {name}
                      </span>
                    </div>
                    <div className="relative shrink-0" style={{ width: W }}>
                      {tk?.kind === "milestone" ? (
                        <span className="absolute top-2.5 h-3.5 w-3.5 rotate-45 bg-slate-300" style={{ left: x(s) + px / 2 - 7 }} title={`${name} — ${f.date(s)}`} />
                      ) : (
                        <div className={cn("absolute top-2.5 h-3.5 overflow-hidden rounded", tk?.kind === "phase" ? "bg-slate-400/60" : tk?.subcontractorId ? "bg-slate-500/50 ring-1 ring-inset ring-slate-300/50" : "bg-blue/70")} style={{ left: x(s), width: Math.max((daysBetween(s, e) + 1) * px, 3) }} title={`${name}\n${f.date(s)} → ${f.date(e)}`}>
                          {tk && tk.progress > 0 && <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${tk.progress}%` }} />}
                        </div>
                      )}
                      {[...cdays].map((day) => (
                        <span key={day} className="absolute bottom-0.5 h-1 rounded-full bg-rose-500" style={{ left: x(day), width: Math.max(px - 1, 2) }} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Charge de travail par semaine */}
              <div className="sticky bottom-0 z-10 flex border-t border-white/10 bg-[var(--card)]" style={{ height: 76 }}>
                <div className="sticky left-0 z-20 shrink-0 border-r border-white/10 bg-[var(--card)] px-3 py-2 text-xs text-slate-400" style={{ width: LEFT }}>
                  <span className="block font-semibold text-slate-300">{t("Charge")}</span>
                  {t("ouvriers nécessaires / disponibles")}
                </div>
                <div className="relative shrink-0" style={{ width: W }}>
                  {load.map((l) => {
                    const lx = x(l.week < from ? from : l.week);
                    const lw = 5 * px - 2;
                    const overload = l.needed > l.available;
                    return (
                      <div key={l.week} className="absolute bottom-2" style={{ left: lx + 1, width: Math.max(lw, 2), height: 56 }} title={`${t("Semaine du {date}", { date: f.date(l.week) })} : ${l.needed} / ${l.available}`}>
                        <div className="absolute bottom-0 w-full rounded-t border-t-2 border-dashed border-slate-400/70" style={{ height: (l.available / maxLoad) * 46 }} />
                        <div className={cn("absolute bottom-0 w-full rounded-t", overload ? "bg-rose-500/80" : "bg-blue/60")} style={{ height: (l.needed / maxLoad) * 46 }} />
                        {lw >= 26 && (
                          <span className={cn("absolute -top-0.5 left-0 w-full text-center text-[10px] font-semibold tabular-nums", overload ? "text-rose-300" : "text-slate-300")}>
                            {overload && "⚠ "}
                            {l.needed}/{l.available}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <GanttLegend />

      {toPlan.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-white">
            {t("À planifier")} ({toPlan.length})
          </p>
          <p className="mb-3 text-xs text-slate-400">{t("Chantiers signés sans dates ou sans équipe. Glissez-les sur la frise ou touchez « Planifier ».")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {toPlan.map((j) => (
              <div
                key={j.id}
                draggable={canMove}
                onDragStart={(e) => e.dataTransfer.setData("text/biltov-job", j.id)}
                className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 p-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{j.name}</span>
                  <span className="text-xs text-slate-400">{!isScheduled(j) ? t("Sans dates") : t("Sans équipe")}</span>
                </span>
                {canMove && (
                  <button onClick={() => setScheduling({ job: j, day: j.startDate || today })} className="btn-ghost !px-3 !py-2 text-xs">
                    {t("Planifier")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {canMove && toPlan.length > 0 && jobs.length > 0 && (
        <DropZone
          onDrop={(id, clientX) => {
            const el = scroller.current;
            const job = data.jobs.find((j) => j.id === id);
            if (!el || !job) return;
            const rect = el.getBoundingClientRect();
            const day = plusDays(from, Math.max(0, Math.floor((clientX - rect.left - LEFT + el.scrollLeft) / px)));
            setScheduling({ job, day });
          }}
          target={scroller}
        />
      )}
      {scheduling && <ScheduleModal job={scheduling.job} day={scheduling.day} onClose={() => setScheduling(null)} />}
    </div>
  );
}

/** Rend la frise réceptrice d'un glisser-déposer « À planifier » (souris). */
function DropZone({ target, onDrop }: { target: React.RefObject<HTMLDivElement | null>; onDrop: (jobId: string, clientX: number) => void }) {
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const over = (e: DragEvent) => e.dataTransfer?.types.includes("text/biltov-job") && e.preventDefault();
    const drop = (e: DragEvent) => {
      const id = e.dataTransfer?.getData("text/biltov-job");
      if (!id) return;
      e.preventDefault();
      onDrop(id, e.clientX);
    };
    el.addEventListener("dragover", over);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("drop", drop);
    };
  }, [target, onDrop]);
  return null;
}

export function GanttLegend() {
  const { t } = useTr();
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
      {(Object.keys(STATE_STYLE) as JobState[]).map((s) => {
        const S = STATE_STYLE[s];
        return (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-5 rounded-sm", S.bar)} />
            <S.icon className="h-3 w-3" /> {t(JOB_STATE_LABEL[s])}
          </span>
        );
      })}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-[repeating-linear-gradient(135deg,rgb(148_163_184/0.3)_0_2px,transparent_2px_4px)] ring-1 ring-white/10" /> {t("Week-end")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-slate-400/25 ring-1 ring-white/10" /> {t("Jour férié")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-blue/15 ring-1 ring-blue/30" /> {t("Congé du bâtiment")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-[repeating-linear-gradient(45deg,rgb(29_78_216/0.5)_0_2px,transparent_2px_4px)]" />
        <CloudRain className="h-3 w-3" /> {t("Intempérie")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-5 rounded-full bg-rose-500" />
        <AlertTriangle className="h-3 w-3" /> {t("Conflit")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-blue" /> {t("Aujourd'hui")}
      </span>
    </div>
  );
}

/** Planifier un chantier : début, durée en jours ouvrables, équipe. */
function ScheduleModal({ job, day, onClose }: { job: Job; day: string; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const cal = data.settings.planning;
  const [start, setStart] = useState(job.startDate || day);
  const [duration, setDuration] = useState(job.startDate && job.endDate ? Math.max(1, workdaysIn(job.startDate, job.endDate, cal).length) : 10);
  const [team, setTeam] = useState<string[]>(job.memberIds);
  const begin = addWorkdays(start, 0, cal);
  const end = addWorkdays(begin, Math.max(1, duration) - 1, cal);
  const members = data.members.filter((m) => m.active && (m.role === "worker" || m.role === "employee"));
  const save = () => {
    upsert("jobs", { ...job, startDate: begin, endDate: end, memberIds: team });
    onClose();
  };
  return (
    <Modal
      title={t("Planifier « {job} »", { job: job.name })}
      onClose={onClose}
      footer={
        <button onClick={save} className="btn-primary ml-auto text-sm">
          {t("Planifier")}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Début")}>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value || start)} className={inputClass} />
          </Field>
          <Field label={t("Durée (jours ouvrables)")}>
            <input type="number" min={1} max={500} value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
          </Field>
        </div>
        <p className="text-sm text-slate-300">
          {f.date(begin)} → <strong className="text-white">{f.date(end)}</strong> <span className="text-slate-500">({t("sans week-ends, jours fériés ni congés du bâtiment")})</span>
        </p>
        {members.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-white">{t("Équipe")}</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = team.includes(m.id);
                return (
                  <button key={m.id} type="button" aria-pressed={on} onClick={() => setTeam(on ? team.filter((x) => x !== m.id) : [...team, m.id])} className={cn("min-h-11 rounded-xl border px-3 text-sm", on ? "border-blue bg-blue text-white" : "border-white/10 text-slate-300")}>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
