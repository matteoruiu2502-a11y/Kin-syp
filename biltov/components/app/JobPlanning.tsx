"use client";

// Planning détaillé d'un chantier (Gantt) : phases → tâches → jalons, dépendances fléchées, chemin critique,
// glisser / redimensionner avec propagation, annuler / rétablir, prévu (figé) vs réel, alertes, création
// depuis un modèle de phases ou depuis le devis accepté, exports PDF (interne et client) et image.

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { AlertTriangle, Diamond, FileText, Flag, Image as ImageIcon, Layers, ListPlus, Loader2, Lock, Move, Plus, Redo2, Trash2, Undo2, Users, Wand2 } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { todayIso } from "@/lib/app/defaults";
import { cn } from "@/lib/utils";
import { assignments, findConflicts } from "@/lib/app/gantt";
import { PHASE_TEMPLATE, createsCycle, criticalPath, durationOf, endFrom, endGap, newTask, phasesFromTemplate, plannedEnd, plannedStart, propagate, rollupPhases, stockOf, taskAlerts, taskHours, tasksFromQuote } from "@/lib/app/schedule";
import { dayOff, daysBetween, eachDay, plusDays, weekday } from "@/lib/app/workdays";
import { coversDay } from "@/lib/app/weather";
import type { Job, Task, TaskDep, TaskKind, TaskStatus } from "@/lib/app/types";
import { Field, Modal, Notice, inputClass } from "./ui";
import { PX, isoWeek, type Zoom } from "./GanttTab";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "À faire", in_progress: "En cours", done: "Terminée", blocked: "Bloquée" };
const ROW = 40;

type Drag = { id: string; mode: "move" | "end"; x0: number; delta: number };

export function JobPlanning({ job }: { job: Job }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, can } = useAppData();
  const today = todayIso();
  const cal = data.settings.planning;
  const canEdit = can("planning", "edit");
  const tasks = useMemo(() => data.tasks.filter((x) => x.jobId === job.id).sort((a, b) => a.order - b.order || a.start.localeCompare(b.start)), [data.tasks, job.id]);
  const [zoom, setZoom] = useState<Zoom>("day");
  const [editing, setEditing] = useState<Task | null>(null);
  const [past, setPast] = useState<Task[][]>([]);
  const [future, setFuture] = useState<Task[][]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);
  const [creating, setCreating] = useState<"template" | "quote" | null>(null);
  const [busy, setBusy] = useState("");
  const [showAlerts, setShowAlerts] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  // ordre d'affichage : chaque phase suivie de ses tâches, puis les tâches sans phase
  const rows = useMemo(() => {
    const out: Task[] = [];
    for (const p of tasks.filter((x) => x.kind === "phase")) out.push(p, ...tasks.filter((x) => x.parentId === p.id));
    out.push(...tasks.filter((x) => x.kind !== "phase" && (!x.parentId || !tasks.some((p) => p.id === x.parentId))));
    return out;
  }, [tasks]);

  const critical = useMemo(() => criticalPath(tasks, cal), [tasks, cal]);
  const end = plannedEnd(tasks);
  const gap = endGap(end, job.contractEndDate, cal);
  const span = useMemo(() => {
    const s = [plannedStart(tasks) ?? job.startDate ?? today, today].filter(Boolean).sort()[0];
    const e = [end ?? job.endDate ?? today, job.contractEndDate ?? "", today].filter(Boolean).sort().reverse()[0];
    const from = plusDays(s, -3 - weekday(s));
    return { from, to: plusDays(e, 10) };
  }, [tasks, end, job, today]);
  const days = useMemo(() => eachDay(span.from, span.to), [span]);
  const px = PX[zoom];
  const W = days.length * px;
  const x = (day: string) => daysBetween(span.from, day) * px;
  // à l'ouverture et au changement de zoom : frise centrée sur aujourd'hui
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, daysBetween(span.from, today) * px - el.clientWidth / 3);
  }, [px, span.from, today, tasks.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // conflits de ressources (avec les autres chantiers) jour par jour, par tâche
  const conflicts = useMemo(() => findConflicts(assignments(data, span.from, span.to), cal), [data, span, cal]);
  const conflictDays = (tk: Task) => [...new Set(conflicts.filter((c) => c.jobIds.includes(job.id) && tk.memberIds.some((m) => c.resource === `m:${m}`)).flatMap((c) => c.days).filter((d) => d >= tk.start && d <= tk.end))];
  const alerts = useMemo(() => taskAlerts(data, tasks, today, conflictDays), [data, tasks, today, conflicts]); // eslint-disable-line react-hooks/exhaustive-deps
  const weather = data.weatherDays.filter((w) => w.jobIds.includes(job.id));

  // ── enregistrement (avec historique annuler / rétablir) ──
  const commit = (next: Task[]) => {
    const rolled = rollupPhases(next);
    setPast((p) => [...p.slice(-30), tasks]);
    setFuture([]);
    write(rolled);
  };
  const write = (next: Task[]) => {
    const s = plannedStart(next.filter((x) => x.kind !== "phase"));
    const e = plannedEnd(next);
    update((d) => ({
      ...d,
      tasks: [...d.tasks.filter((x) => x.jobId !== job.id), ...next],
      // la fin prévue du chantier suit son planning détaillé
      jobs: can("jobs", "edit") && s && e ? d.jobs.map((j) => (j.id === job.id ? { ...j, startDate: s, endDate: e } : j)) : d.jobs,
    }));
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(past.slice(0, -1));
    setFuture((fu) => [tasks, ...fu]);
    write(prev);
  };
  const redo = () => {
    const nx = future[0];
    if (!nx) return;
    setFuture(future.slice(1));
    setPast((p) => [...p, tasks]);
    write(nx);
  };

  const saveTask = (tk: Task) => {
    const exists = tasks.some((x) => x.id === tk.id);
    const after = exists ? tasks.map((x) => (x.id === tk.id ? tk : x)) : [...tasks, { ...tk, order: tasks.length }];
    commit(propagate(tasks, after, cal));
  };
  const deleteTask = (id: string) => {
    const after = tasks.filter((x) => x.id !== id && x.parentId !== id).map((x) => ({ ...x, deps: x.deps.filter((d) => d.taskId !== id), parentId: x.parentId === id ? null : x.parentId }));
    commit(after);
  };

  // ── glisser une barre ──
  const onDown = (e: RPointerEvent, tk: Task, mode: Drag["mode"]) => {
    if (!canEdit || tk.kind === "phase" || (e.pointerType !== "mouse" && !moveMode)) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: tk.id, mode, x0: e.clientX, delta: 0 });
  };
  const onMove = (e: RPointerEvent) => drag && setDrag({ ...drag, delta: Math.round((e.clientX - drag.x0) / px) });
  const onUp = () => {
    if (!drag) return;
    const tk = tasks.find((x) => x.id === drag.id);
    setDrag(null);
    if (!tk || !drag.delta) return;
    let moved: Task;
    if (drag.mode === "move") {
      const dur = durationOf(tk, cal);
      const start = endFrom(plusDays(tk.start, drag.delta), 1, cal); // premier jour ouvrable
      moved = { ...tk, start, end: tk.kind === "milestone" ? start : endFrom(start, dur, cal) };
    } else {
      const e2 = plusDays(tk.end, drag.delta);
      moved = { ...tk, end: e2 < tk.start ? tk.start : endFrom(e2, 1, cal) };
    }
    commit(propagate(tasks, tasks.map((x) => (x.id === tk.id ? moved : x)), cal));
  };

  const freezeBaseline = () => {
    if (tasks.some((x) => x.baseline) && !window.confirm(t("Remplacer la planification de départ par les dates actuelles ?"))) return;
    commit(tasks.map((x) => ({ ...x, baseline: { start: x.start, end: x.end } })));
  };

  const exportAs = async (kind: "pdf" | "png", client = false) => {
    setBusy(kind + (client ? "c" : ""));
    try {
      const { exportModel, jobRows } = await import("@/lib/app/ganttExport");
      const cl = data.clients.find((c) => c.id === job.clientId);
      const notes = client
        ? [end ? `Fin prévue des travaux : ${end.split("-").reverse().join("/")}` : "", "Planning prévisionnel, susceptible d'évoluer (météo, approvisionnements, choix du client)."].filter(Boolean)
        : [
            ...(gap !== null ? [`Fin prévue ${end?.split("-").reverse().join("/")} — fin contractuelle ${job.contractEndDate?.split("-").reverse().join("/")} : ${gap > 0 ? `${gap} jour(s) de retard` : gap < 0 ? `${-gap} jour(s) d'avance` : "à l'heure"}`] : []),
            ...alerts.map((a) => `${tasks.find((x) => x.id === a.taskId)?.name} : ${a.text}`),
          ];
      await exportModel(
        kind,
        {
          title: client ? "Planning prévisionnel" : "Planning du chantier",
          subtitle: [job.name, cl?.name, job.siteAddress].filter(Boolean).join(" · "),
          company: data.company.name || "Biltov",
          logo: data.branding.logo,
          from: span.from,
          to: span.to,
          today,
          rows: jobRows(data, job, rows, { critical, conflictDays, client }),
          notes,
          cal,
          author: data.company.owner || data.company.name,
          columns: client ? "client" : "full",
          scope: "job",
        },
        `planning-${client ? "client-" : ""}${job.name}`,
      );
    } finally {
      setBusy("");
    }
  };

  const months = days.filter((d) => d === days[0] || d.endsWith("-01"));
  const yOf = new Map(rows.map((r, i) => [r.id, i * ROW + ROW / 2]));
  const alertCount = (id: string) => alerts.filter((a) => a.taskId === id).length;

  return (
    <div className="space-y-4 [--left:160px] sm:[--left:240px] lg:[--left:440px]">
      {/* En-tête : fin prévue vs contractuelle */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Box label={t("Fin prévue")} value={end ? f.date(end) : "—"} />
        <Box label={t("Fin contractuelle")} value={job.contractEndDate ? f.date(job.contractEndDate) : t("non renseignée")} />
        <Box label={t("Écart")} value={gap === null ? "—" : gap > 0 ? t("{n} j de retard", { n: gap }) : gap < 0 ? t("{n} j d'avance", { n: -gap }) : t("À l'heure")} tone={gap === null ? undefined : gap > 0 ? "danger" : "ok"} />
        <Box label={t("Tâches critiques")} value={String(critical.size)} />
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <button onClick={() => setEditing(newTask({ jobId: job.id, name: "", start: endFrom(today > (job.startDate || today) ? today : job.startDate || today, 1, cal), end: endFrom(today > (job.startDate || today) ? today : job.startDate || today, 3, cal), memberIds: job.memberIds }))} className="btn-primary !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Tâche")}
            </button>
            {!tasks.length && (
              <button onClick={() => setCreating("template")} className="btn-ghost !py-2.5 text-sm">
                <Layers className="h-4 w-4" /> {t("Modèle de phases")}
              </button>
            )}
            {data.docs.some((d) => d.jobId === job.id && d.type === "quote" && d.status === "accepted") && (
              <button onClick={() => setCreating("quote")} className="btn-ghost !py-2.5 text-sm">
                <Wand2 className="h-4 w-4" /> {t("Depuis le devis")}
              </button>
            )}
            {tasks.length > 0 && (
              <button onClick={freezeBaseline} className="btn-ghost !py-2.5 text-sm" title={t("Mémoriser les dates actuelles comme planification de départ (prévu)")}>
                <Lock className="h-4 w-4" /> {t("Figer le prévu")}
              </button>
            )}
            <button onClick={undo} disabled={!past.length} className="btn-ghost !px-3 !py-2.5 text-sm disabled:opacity-40" aria-label={t("Annuler")} title={t("Annuler")}>
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={redo} disabled={!future.length} className="btn-ghost !px-3 !py-2.5 text-sm disabled:opacity-40" aria-label={t("Rétablir")} title={t("Rétablir")}>
              <Redo2 className="h-4 w-4" />
            </button>
            <button onClick={() => setMoveMode(!moveMode)} aria-pressed={moveMode} className={cn("btn-ghost !py-2.5 text-sm lg:hidden", moveMode && "!border-blue !text-cyan")}>
              <Move className="h-4 w-4" /> {t("Déplacer")}
            </button>
          </>
        )}
        {tasks.length > 0 && (
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button onClick={() => exportAs("pdf")} disabled={!!busy} className="btn-ghost !py-2.5 text-sm">
              {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
            </button>
            <button onClick={() => exportAs("pdf", true)} disabled={!!busy} className="btn-ghost !py-2.5 text-sm" title={t("Version simplifiée pour le client, sans coûts ni alertes internes")}>
              {busy === "pdfc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} {t("PDF client")}
            </button>
            <button onClick={() => exportAs("png")} disabled={!!busy} className="btn-ghost !py-2.5 text-sm">
              {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} {t("Image")}
            </button>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/[0.06] p-3">
          <button onClick={() => setShowAlerts(!showAlerts)} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> {t("{n} alerte(s) sur le planning", { n: alerts.length })}
          </button>
          {showAlerts && (
            <ul className="mt-2 space-y-1 text-sm">
              {alerts.map((a, i) => (
                <li key={i}>
                  <button onClick={() => setEditing(tasks.find((x) => x.id === a.taskId) ?? null)} className="text-left text-slate-300 hover:text-white">
                    <span className="font-semibold text-white">{tasks.find((x) => x.id === a.taskId)?.name}</span> — {a.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!tasks.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
          {t("Aucune tâche. Partez d'un modèle de phases du bâtiment, du devis accepté, ou ajoutez vos tâches une à une.")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
              {(["day", "week", "month"] as const).map((z) => (
                <button key={z} role="tab" aria-selected={zoom === z} onClick={() => setZoom(z)} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", zoom === z ? "bg-blue text-white" : "text-slate-400 hover:text-white")}>
                  {t({ day: "Jour", week: "Semaine", month: "Mois", quarter: "Trimestre" }[z])}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} className="accent-blue-600" /> {t("Afficher le prévu")}
            </label>
          </div>

          <div className="card overflow-hidden !rounded-2xl">
            <div ref={scroller} className="relative max-h-[70vh] overflow-auto overscroll-x-contain" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
              <div className="relative" style={{ width: `calc(var(--left) + ${W}px)` }}>
                <div className="sticky top-0 z-20 flex border-b border-white/10 bg-[var(--card)]">
                  <div className="sticky left-0 z-30 grid shrink-0 grid-cols-[1fr] items-end border-r border-white/10 bg-[var(--card)] px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 lg:grid-cols-[1fr_44px_74px_74px]" style={{ width: "var(--left)" }}>
                    <span>{t("Tâche")}</span>
                    <span className="hidden text-right lg:block">{t("j")}</span>
                    <span className="hidden text-right lg:block">{t("Début")}</span>
                    <span className="hidden text-right lg:block">{t("Fin")}</span>
                  </div>
                  <div className="relative h-11 shrink-0" style={{ width: W }}>
                    {months.map((m, i) => (
                      <div key={m} className="absolute top-0 truncate border-l border-white/10 px-1.5 pt-1 text-xs font-semibold capitalize text-slate-300" style={{ left: x(m), width: (months[i + 1] ? x(months[i + 1]) : W) - x(m) }}>
                        {new Date(`${m}T12:00:00Z`).toLocaleDateString(f.locale, { month: "long", year: "numeric" })}
                      </div>
                    ))}
                    {zoom === "day" && days.map((d) => (
                      <div key={d} className={cn("absolute bottom-0 text-center text-[10px]", d === today ? "font-bold text-cyan" : "text-slate-500")} style={{ left: x(d), width: px }}>
                        {Number(d.slice(8))}
                      </div>
                    ))}
                    {zoom === "week" && days.filter((d) => weekday(d) === 0).map((d) => (
                      <div key={d} className="absolute bottom-0 border-l border-white/5 pl-1 text-[10px] text-slate-500" style={{ left: x(d) }}>
                        {t("S{n}", { n: isoWeek(d) })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* fonds */}
                <div className="pointer-events-none absolute z-0" style={{ left: "var(--left)", top: 44, width: W, height: rows.length * ROW }}>
                  {days.map((d) => {
                    const off = dayOff(d, cal);
                    const wet = weather.some((w) => coversDay(w, d));
                    if (!off && !wet) return null;
                    return (
                      <div
                        key={d}
                        title={[off?.label, wet ? t("Intempérie") : ""].filter(Boolean).join(" · ")}
                        className={cn(
                          "absolute top-0 h-full",
                          wet ? "bg-[repeating-linear-gradient(45deg,rgb(29_78_216/0.2)_0_2px,transparent_2px_5px)]" : off!.kind === "weekend" ? "bg-[repeating-linear-gradient(135deg,rgb(148_163_184/0.10)_0_3px,transparent_3px_6px)]" : off!.kind === "holiday" ? "bg-slate-400/15" : "bg-blue/[0.08]",
                        )}
                        style={{ left: x(d), width: Math.max(px, 1) }}
                      />
                    );
                  })}
                  {job.contractEndDate && <div className="absolute top-0 h-full border-l-2 border-dashed border-rose-400/70" style={{ left: x(job.contractEndDate) + px }} title={t("Fin contractuelle")} />}
                  <div className="absolute top-0 h-full w-0.5 bg-blue" style={{ left: x(today) + px / 2 }} />
                  {/* flèches de dépendance */}
                  <svg className="absolute inset-0 overflow-visible" width={W} height={rows.length * ROW} aria-hidden>
                    <defs>
                      <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M0,0 L8,4 L0,8 z" fill="rgb(100 116 139)" />
                      </marker>
                    </defs>
                    {rows.flatMap((tk) =>
                      tk.deps.map((dep) => {
                        const p = tasks.find((x) => x.id === dep.taskId);
                        if (!p || !yOf.has(p.id) || !yOf.has(tk.id)) return null;
                        const x1 = dep.type === "SS" ? x(p.start) : x(p.end) + px;
                        const y1 = yOf.get(p.id)!;
                        const x2 = x(tk.start) - 1;
                        const y2 = yOf.get(tk.id)!;
                        const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 12));
                        const crit = critical.has(p.id) && critical.has(tk.id);
                        return <path key={`${p.id}-${tk.id}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke={crit ? "rgb(220 38 38)" : "rgb(100 116 139)"} strokeWidth={crit ? 1.6 : 1.2} markerEnd="url(#arr)" />;
                      }),
                    )}
                  </svg>
                </div>

                {rows.map((tk) => {
                  const d = drag?.id === tk.id ? drag : null;
                  let s = d?.mode === "move" ? plusDays(tk.start, d.delta) : tk.start;
                  let e = d?.mode === "move" ? plusDays(tk.end, d.delta) : d ? plusDays(tk.end, d.delta) : tk.end;
                  if (e < s) e = s;
                  if (tk.kind === "milestone") e = s;
                  const crit = critical.has(tk.id);
                  const cdays = conflictDays(tk);
                  const n = alertCount(tk.id);
                  const hours = tk.kind === "task" ? taskHours(data, tk) : null;
                  const sub = tk.subcontractorId ? data.suppliers.find((x) => x.id === tk.subcontractorId)?.name : null;
                  return (
                    <div key={tk.id} className="relative flex border-b border-white/5" style={{ height: ROW }}>
                      <button
                        onClick={() => setEditing(tk)}
                        className="sticky left-0 z-10 grid shrink-0 grid-cols-[1fr] items-center gap-1 border-r border-white/10 bg-[var(--card)] px-3 text-left text-sm lg:grid-cols-[1fr_44px_74px_74px]"
                        style={{ width: "var(--left)" }}
                      >
                        <span className={cn("flex min-w-0 items-center gap-1.5", tk.kind !== "phase" && tk.parentId && "pl-4")}>
                          {tk.kind === "milestone" ? <Flag className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : tk.kind === "phase" ? <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                          <span className={cn("truncate", tk.kind === "phase" ? "font-semibold text-white" : "text-slate-200", tk.status === "done" && "line-through decoration-slate-500")} title={tk.name}>
                            {tk.name || t("(sans nom)")}
                          </span>
                          {crit && <span className="shrink-0 rounded border border-rose-400/50 px-1 text-[9px] font-bold uppercase text-rose-300" title={t("Chemin critique")}>{t("crit.")}</span>}
                          {sub && <span className="hidden shrink-0 rounded border border-white/15 px-1 text-[9px] uppercase text-slate-400 sm:inline" title={sub}>{t("ext.")}</span>}
                          {n > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label={t("{n} alerte(s)", { n })} />}
                        </span>
                        <span className="hidden text-right text-xs tabular-nums text-slate-400 lg:block">{tk.kind === "milestone" ? "◆" : durationOf(tk, cal)}</span>
                        <span className="hidden text-right text-xs tabular-nums text-slate-400 lg:block">{f.date(tk.start).slice(0, 5)}</span>
                        <span className="hidden text-right text-xs tabular-nums text-slate-400 lg:block">{tk.kind === "milestone" ? "" : f.date(tk.end).slice(0, 5)}</span>
                      </button>
                      <div className="relative shrink-0" style={{ width: W }}>
                        {showBaseline && tk.baseline && tk.kind !== "phase" && (
                          <div className="absolute h-1.5 rounded-full bg-slate-400/50" style={{ left: x(tk.baseline.start), width: Math.max((daysBetween(tk.baseline.start, tk.baseline.end) + 1) * px, 3), top: ROW - 9 }} title={`${t("Prévu")} : ${f.date(tk.baseline.start)} → ${f.date(tk.baseline.end)}`} />
                        )}
                        {tk.kind === "milestone" ? (
                          <span
                            onPointerDown={(ev) => onDown(ev, tk, "move")}
                            role="img"
                            aria-label={`${tk.name} : ${f.date(s)}`}
                            className={cn("absolute h-4 w-4 rotate-45", crit ? "bg-rose-500" : "bg-slate-300", canEdit && "cursor-grab")}
                            style={{ left: x(s) + px / 2 - 8, top: ROW / 2 - 8, touchAction: moveMode ? "none" : "auto" }}
                          />
                        ) : (
                          <div
                            role="img"
                            aria-label={`${tk.name} : ${f.date(s)} → ${f.date(e)}, ${tk.progress} %`}
                            title={`${tk.name}\n${f.date(s)} → ${f.date(e)} · ${tk.progress} %${hours ? `\n${t("Pointé")} ${hours.done} h / ${hours.planned} h` : ""}`}
                            onPointerDown={(ev) => onDown(ev, tk, "move")}
                            className={cn(
                              "absolute flex items-center overflow-hidden rounded-md text-[11px] font-semibold text-white",
                              tk.kind === "phase" ? "h-2.5 bg-slate-400/70" : sub ? "h-5 bg-slate-500/60 ring-1 ring-inset ring-slate-300/50" : tk.status === "done" ? "h-5 bg-emerald-500" : "h-5 bg-blue",
                              crit && tk.kind !== "phase" && "ring-2 ring-rose-500",
                              canEdit && tk.kind !== "phase" && "cursor-grab active:cursor-grabbing",
                              d && "opacity-80",
                            )}
                            style={{ left: x(s), width: Math.max((daysBetween(s, e) + 1) * px, 4), top: tk.kind === "phase" ? ROW / 2 - 5 : ROW / 2 - 12, touchAction: moveMode ? "none" : "auto" }}
                          >
                            {tk.progress > 0 && tk.kind !== "phase" && <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${tk.progress}%` }} />}
                            {tk.kind !== "phase" && (daysBetween(s, e) + 1) * px > 50 && <span className="relative truncate px-1.5">{tk.progress} %</span>}
                            {canEdit && tk.kind === "task" && <span onPointerDown={(ev) => onDown(ev, tk, "end")} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/30" aria-hidden />}
                          </div>
                        )}
                        {cdays.map((day) => (
                          <span key={day} className="absolute bottom-0.5 h-1 rounded-full bg-rose-500" style={{ left: x(day), width: Math.max(px - 1, 2) }} title={t("Conflit")} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-blue" /> {t("Tâche")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-emerald-500" /> {t("Terminée")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-slate-500/60 ring-1 ring-slate-300/50" /> {t("Sous-traitant")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm ring-2 ring-rose-500" /> {t("Chemin critique")}</span>
            <span className="flex items-center gap-1.5"><Diamond className="h-3 w-3" /> {t("Jalon")}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-slate-400/50" /> {t("Prévu (figé)")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-0 border-l-2 border-dashed border-rose-400" /> {t("Fin contractuelle")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[repeating-linear-gradient(45deg,rgb(29_78_216/0.5)_0_2px,transparent_2px_4px)]" /> {t("Intempérie")}</span>
          </div>
        </>
      )}

      {editing && <TaskForm job={job} task={editing} tasks={tasks} onClose={() => setEditing(null)} onSave={(tk) => (saveTask(tk), setEditing(null))} onDelete={(id) => (deleteTask(id), setEditing(null))} readOnly={!canEdit} />}
      {creating && <CreateModal job={job} mode={creating} onClose={() => setCreating(null)} onCreate={(list) => (commit(list), setCreating(null))} replace={tasks.length > 0} />}
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <span className="block text-xs text-slate-400">{label}</span>
      <span className={cn("font-display text-lg font-bold text-white", tone === "danger" && "text-rose-300", tone === "ok" && "text-emerald")}>{value}</span>
    </div>
  );
}

// ── Fiche tâche ──────────────────────────────────────────────────────────────

function TaskForm({ job, task, tasks, onClose, onSave, onDelete, readOnly }: { job: Job; task: Task; tasks: Task[]; onClose: () => void; onSave: (t: Task) => void; onDelete: (id: string) => void; readOnly: boolean }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const cal = data.settings.planning;
  const isNew = !tasks.some((x) => x.id === task.id);
  const [d, setD] = useState<Task>(task);
  const [dur, setDur] = useState(durationOf(task, cal));
  const [depPick, setDepPick] = useState<{ taskId: string; type: TaskDep["type"]; lag: number }>({ taskId: "", type: "FS", lag: 0 });
  const [mat, setMat] = useState({ articleId: "", qty: 1 });
  const [err, setErr] = useState("");
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setD((x) => ({ ...x, [k]: v }));
  const members = data.members.filter((m) => m.active && (m.role === "worker" || m.role === "employee" || m.role === "admin" || m.role === "owner"));
  const subs = data.suppliers.filter((s) => s.kind === "subcontractor");
  const phases = tasks.filter((x) => x.kind === "phase" && x.id !== d.id);
  const others = tasks.filter((x) => x.id !== d.id && x.kind !== "phase");
  const hours = d.kind === "task" && !isNew ? taskHours(data, d) : null;
  const end = d.kind === "milestone" ? d.start : endFrom(d.start, dur, cal);

  const save = () => {
    if (!d.name.trim()) return setErr(t("Donnez un nom à la tâche."));
    onSave({ ...d, name: d.name.trim(), end: d.kind === "phase" ? d.end : end, status: d.progress >= 100 ? "done" : d.status === "done" && d.progress < 100 ? "in_progress" : d.status });
  };
  const addDep = () => {
    if (!depPick.taskId) return;
    if (createsCycle([...tasks.filter((x) => x.id !== d.id), d], d.id, depPick.taskId)) return setErr(t("Cette dépendance créerait une boucle."));
    set("deps", [...d.deps.filter((x) => x.taskId !== depPick.taskId), depPick]);
    setDepPick({ taskId: "", type: "FS", lag: 0 });
    setErr("");
  };
  const chip = (on: boolean) => cn("min-h-11 rounded-xl border px-3 text-sm", on ? "border-blue bg-blue text-white" : "border-white/10 text-slate-300");

  return (
    <Modal
      title={isNew ? t("Nouvelle tâche") : d.name || t("Tâche")}
      onClose={onClose}
      wide
      footer={
        !readOnly && (
          <div className="flex w-full items-center gap-2">
            {!isNew && (
              <button onClick={() => window.confirm(t("Supprimer cette tâche ?")) && onDelete(d.id)} className="btn-ghost !px-3 text-sm text-rose-300" aria-label={t("Supprimer")}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={save} className="btn-primary ml-auto text-sm">
              {t("Enregistrer")}
            </button>
          </div>
        )
      }
    >
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label={t("Nom")}>
            <input autoFocus={isNew} value={d.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("Type")}>
            <select value={d.kind} onChange={(e) => set("kind", e.target.value as TaskKind)} className={inputClass}>
              <option value="task">{t("Tâche")}</option>
              <option value="phase">{t("Phase")}</option>
              <option value="milestone">{t("Jalon")}</option>
            </select>
          </Field>
        </div>
        {d.kind !== "phase" && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label={t("Début")}>
                <input type="date" value={d.start} onChange={(e) => e.target.value && set("start", e.target.value)} className={inputClass} />
              </Field>
              {d.kind === "task" && (
                <Field label={t("Durée (jours ouvrables)")}>
                  <input type="number" min={1} max={400} value={dur} onChange={(e) => setDur(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
                </Field>
              )}
              <Field label={t("Fin")}>
                <input type="text" readOnly value={f.date(end)} className={cn(inputClass, "opacity-80")} />
              </Field>
              {phases.length > 0 && (
                <Field label={t("Phase")}>
                  <select value={d.parentId ?? ""} onChange={(e) => set("parentId", e.target.value || null)} className={inputClass}>
                    <option value="">—</option>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            {d.kind === "task" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${t("Avancement")} : ${d.progress} %`}>
                  <input type="range" min={0} max={100} step={5} value={d.progress} onChange={(e) => set("progress", Number(e.target.value))} className="range" style={{ "--fill": `${d.progress}%` } as React.CSSProperties} />
                </Field>
                <Field label={t("Statut")}>
                  <select value={d.status} onChange={(e) => setD((x) => ({ ...x, status: e.target.value as TaskStatus, progress: e.target.value === "done" ? 100 : x.progress }))} className={inputClass}>
                    {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {t(STATUS_LABEL[s])}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {hours && (
              <p className="text-sm text-slate-400">
                {t("Pointé")} : <strong className="text-white">{hours.done} h</strong> / {t("prévu")} {hours.planned} h{d.baseline && ` · ${t("Prévu (figé)")} : ${f.date(d.baseline.start)} → ${f.date(d.baseline.end)}`}
              </p>
            )}
            {d.kind === "task" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("Responsable")}>
                    <select value={d.ownerId ?? ""} onChange={(e) => set("ownerId", e.target.value || null)} className={inputClass}>
                      <option value="">—</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {subs.length > 0 && (
                    <Field label={t("Sous-traitant (tâche externe)")}>
                      <select value={d.subcontractorId ?? ""} onChange={(e) => set("subcontractorId", e.target.value || null)} className={inputClass}>
                        <option value="">{t("Nos équipes")}</option>
                        {subs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">{t("Ouvriers")}</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => {
                      const on = d.memberIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" aria-pressed={on} onClick={() => set("memberIds", on ? d.memberIds.filter((x) => x !== m.id) : [...d.memberIds, m.id])} className={chip(on)}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {data.vehicles.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-white">{t("Véhicules / matériel")}</p>
                    <div className="flex flex-wrap gap-2">
                      {data.vehicles.map((v) => {
                        const on = d.vehicleIds.includes(v.id);
                        return (
                          <button key={v.id} type="button" aria-pressed={on} onClick={() => set("vehicleIds", on ? d.vehicleIds.filter((x) => x !== v.id) : [...d.vehicleIds, v.id])} className={chip(on)}>
                            {v.plate}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="rounded-2xl border border-white/10 p-3">
              <p className="mb-2 text-sm font-semibold text-white">{t("Dépendances")}</p>
              {d.deps.map((dep) => (
                <div key={dep.taskId} className="mb-1 flex items-center gap-2 text-sm text-slate-300">
                  <span className="flex-1 truncate">
                    {dep.type === "FS" ? t("Après la fin de") : t("En même temps que le début de")} « {tasks.find((x) => x.id === dep.taskId)?.name} »{dep.lag ? ` ${dep.lag > 0 ? "+" : ""}${dep.lag} ${t("j")}` : ""}
                  </span>
                  <button type="button" onClick={() => set("deps", d.deps.filter((x) => x.taskId !== dep.taskId))} className="rounded-lg p-2 text-slate-400 hover:bg-white/5" aria-label={t("Retirer")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {others.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-[1fr_170px_90px_auto]">
                  <select value={depPick.taskId} onChange={(e) => setDepPick({ ...depPick, taskId: e.target.value })} className={inputClass} aria-label={t("Tâche précédente")}>
                    <option value="">{t("Tâche précédente…")}</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <select value={depPick.type} onChange={(e) => setDepPick({ ...depPick, type: e.target.value as TaskDep["type"] })} className={inputClass} aria-label={t("Lien")}>
                    <option value="FS">{t("Fin → début")}</option>
                    <option value="SS">{t("Début → début")}</option>
                  </select>
                  <input type="number" value={depPick.lag} onChange={(e) => setDepPick({ ...depPick, lag: Math.round(Number(e.target.value) || 0) })} className={inputClass} aria-label={t("Délai (jours, négatif = avance)")} title={t("Délai (jours, négatif = avance)")} />
                  <button type="button" onClick={addDep} className="btn-ghost !py-2.5 text-sm">
                    <ListPlus className="h-4 w-4" /> {t("Ajouter")}
                  </button>
                </div>
              )}
            </div>

            {d.kind === "task" && data.articles.length > 0 && (
              <div className="rounded-2xl border border-white/10 p-3">
                <p className="mb-2 text-sm font-semibold text-white">{t("Matériaux nécessaires")}</p>
                {d.materials.map((m) => {
                  const a = data.articles.find((x) => x.id === m.articleId);
                  const have = stockOf(data, m.articleId);
                  return (
                    <div key={m.articleId} className="mb-1 flex items-center gap-2 text-sm text-slate-300">
                      <span className="flex-1 truncate">
                        {m.qty} {a?.unit} — {a?.name.fr}
                      </span>
                      <span className={cn("text-xs", have < m.qty ? "text-rose-300" : "text-emerald")}>
                        {t("stock")} {have}
                      </span>
                      <button type="button" onClick={() => set("materials", d.materials.filter((x) => x.articleId !== m.articleId))} className="rounded-lg p-2 text-slate-400 hover:bg-white/5" aria-label={t("Retirer")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                <div className="grid gap-2 sm:grid-cols-[1fr_90px_auto]">
                  <select value={mat.articleId} onChange={(e) => setMat({ ...mat, articleId: e.target.value })} className={inputClass} aria-label={t("Article")}>
                    <option value="">{t("Article du catalogue…")}</option>
                    {data.articles
                      .filter((a) => a.active && a.type !== "labour")
                      .slice(0, 300)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name.fr}
                        </option>
                      ))}
                  </select>
                  <input type="number" min={0} step="any" value={mat.qty} onChange={(e) => setMat({ ...mat, qty: Number(e.target.value) || 0 })} className={inputClass} aria-label={t("Quantité")} />
                  <button type="button" onClick={() => mat.articleId && (set("materials", [...d.materials.filter((x) => x.articleId !== mat.articleId), { articleId: mat.articleId, qty: mat.qty }]), setMat({ articleId: "", qty: 1 }))} className="btn-ghost !py-2.5 text-sm">
                    <Plus className="h-4 w-4" /> {t("Ajouter")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        <Field label={t("Notes")}>
          <textarea rows={2} value={d.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
        </Field>
        {err && <Notice tone="warn">{err}</Notice>}
        {d.kind === "phase" && <p className="text-xs text-slate-400">{t("Les dates d'une phase suivent celles de ses tâches.")}</p>}
        {!isNew && job.contractEndDate && end > job.contractEndDate && d.kind !== "phase" && <Notice tone="warn">{t("Cette tâche finit après la fin contractuelle du chantier.")}</Notice>}
      </fieldset>
    </Modal>
  );
}

// ── Création : modèle de phases ou devis accepté ─────────────────────────────

function CreateModal({ job, mode, onClose, onCreate, replace }: { job: Job; mode: "template" | "quote"; onClose: () => void; onCreate: (t: Task[]) => void; replace: boolean }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const cal = data.settings.planning;
  const quotes = data.docs.filter((d) => d.jobId === job.id && d.type === "quote" && d.status === "accepted");
  const [quoteId, setQuoteId] = useState(quotes[0]?.id ?? "");
  const [names, setNames] = useState<string[]>(PHASE_TEMPLATE.map((p) => p.name));
  const [start, setStart] = useState(job.startDate || todayIso());
  const base = { ...job, startDate: start };
  const preview = mode === "template" ? phasesFromTemplate(base, cal, names) : quotes.find((q) => q.id === quoteId) ? tasksFromQuote(quotes.find((q) => q.id === quoteId)!, base, cal) : [];
  const [durations, setDurations] = useState<Record<number, number>>({});

  // applique les durées modifiées en chaîne (chaque tâche suit la précédente)
  const final = (() => {
    const list = preview.map((tk, i) => (durations[i] && tk.kind === "task" ? { ...tk, end: endFrom(tk.start, durations[i], cal) } : tk));
    return propagate(preview, list, cal);
  })();

  return (
    <Modal
      title={mode === "template" ? t("Modèle de phases du bâtiment") : t("Créer le planning depuis le devis")}
      onClose={onClose}
      wide
      footer={
        <button onClick={() => (!replace || window.confirm(t("Remplacer les tâches existantes de ce chantier ?"))) && onCreate(final)} disabled={!final.length} className="btn-primary ml-auto text-sm disabled:opacity-50">
          {t("Créer {n} élément(s)", { n: final.length })}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Début des travaux")}>
            <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className={inputClass} />
          </Field>
          {mode === "quote" && (
            <Field label={t("Devis accepté")}>
              <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className={inputClass}>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.number ?? t("Devis")}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {mode === "template" && (
          <div className="flex flex-wrap gap-2">
            {PHASE_TEMPLATE.map((p) => {
              const on = names.includes(p.name);
              return (
                <button key={p.name} type="button" aria-pressed={on} onClick={() => setNames(on ? names.filter((n) => n !== p.name) : [...names, p.name])} className={cn("min-h-11 rounded-xl border px-3 text-sm", on ? "border-blue bg-blue text-white" : "border-white/10 text-slate-300")}>
                  {t(p.name)}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-slate-400">{mode === "template" ? t("Durées proposées, modifiables ci-dessous ; chaque phase suit la précédente.") : t("Une phase par titre du devis ; durée estimée d'après les heures de main-d'œuvre (modifiable) ; les lignes sous-traitées deviennent des tâches externes.")}</p>
        <ul className="max-h-[45vh] space-y-1 overflow-y-auto">
          {final.map((tk, i) => (
            <li key={tk.id} className={cn("flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm", tk.kind === "phase" && "bg-white/[0.03]")}>
              <span className={cn("min-w-0 flex-1 truncate", tk.kind === "phase" ? "font-semibold text-white" : "text-slate-300", tk.parentId && "pl-3")}>
                {tk.kind === "milestone" ? "◆ " : ""}
                {t(tk.name)}
              </span>
              <span className="text-xs tabular-nums text-slate-400">
                {f.date(tk.start).slice(0, 5)} → {f.date(tk.end).slice(0, 5)}
              </span>
              {tk.kind === "task" && (
                <input type="number" min={1} max={200} value={durations[i] ?? durationOf(tk, cal)} onChange={(e) => setDurations({ ...durations, [i]: Math.max(1, Number(e.target.value) || 1) })} className={cn(inputClass, "!w-16 !py-1.5")} aria-label={t("Durée (jours ouvrables)")} />
              )}
            </li>
          ))}
        </ul>
        {mode === "quote" && !final.length && <Notice tone="warn">{t("Ce devis n'a pas de ligne à planifier.")}</Notice>}
      </div>
    </Modal>
  );
}
