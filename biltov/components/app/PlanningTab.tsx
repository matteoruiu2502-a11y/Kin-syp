"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, CloudRain, Download, Plus, Sun, Truck, X } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, todayIso, uid } from "@/lib/app/defaults";
import { badWeather, conflicts, fetchWeather, mondayOf, moveEvent, onDay, toIcs, weekDays, type DayWeather, type PlanningRow } from "@/lib/app/planning";
import { downloadBlob } from "@/lib/app/send";
import type { EventKind, PlanningEvent } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { needsProof } from "@/lib/app/weather";
import { holidayName } from "@/lib/app/workdays";
import { Field, Modal, Notice, PageHeader, SubTabs, inputClass } from "./ui";
import { WeatherTab } from "./WeatherTab";
import { GanttTab } from "./GanttTab";

export const EVENT_KIND: Record<EventKind, { label: string; color: string }> = {
  job: { label: "Chantier", color: "#2563eb" },
  visit: { label: "Visite / métré", color: "#06b6d4" },
  appointment: { label: "Rendez-vous", color: "#8b5cf6" },
  leave: { label: "Congé / absence", color: "#f59e0b" },
  maintenance: { label: "Entretien / SAV", color: "#10b981" },
};

export function EventForm({ event, onClose }: { event: PlanningEvent; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, remove } = useAppData();
  const [e, setE] = useState(event);
  const set = <K extends keyof PlanningEvent>(k: K, v: PlanningEvent[K]) => setE((x) => ({ ...x, [k]: v }));
  const clash = conflicts(data, e);
  const exists = data.events.some((x) => x.id === e.id);
  const name = (id: string) => data.members.find((m) => m.id === id)?.name ?? "?";

  return (
    <Modal
      title={exists ? t("Modifier l'événement") : t("Nouvel événement")}
      onClose={onClose}
      footer={
        <>
          {exists && (
            <button onClick={() => (remove("events", e.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button
            disabled={!e.title.trim() || e.end < e.start}
            onClick={() => {
              upsert("events", e);
              onClose();
            }}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Type")}>
          <select className={inputClass} value={e.kind} onChange={(ev) => set("kind", ev.target.value as EventKind)}>
            {(Object.keys(EVENT_KIND) as EventKind[]).map((k) => (
              <option key={k} value={k}>
                {t(EVENT_KIND[k].label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Chantier")}>
          <select
            className={inputClass}
            value={e.jobId ?? ""}
            onChange={(ev) => {
              const j = data.jobs.find((x) => x.id === ev.target.value);
              setE((x) => ({ ...x, jobId: j?.id ?? null, clientId: j?.clientId ?? x.clientId, title: x.title || j?.name || "" }));
            }}
          >
            <option value="">—</option>
            {data.jobs
              .filter((j) => !["refused", "lost"].includes(j.status))
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={`${t("Titre")} *`} className="sm:col-span-2">
          <input className={inputClass} value={e.title} onChange={(ev) => set("title", ev.target.value)} />
        </Field>
        <Field label={t("Début")}>
          <input type="datetime-local" className={inputClass} value={e.start} onChange={(ev) => set("start", ev.target.value)} />
        </Field>
        <Field label={t("Fin")} error={e.end < e.start && t("La fin précède le début.")}>
          <input type="datetime-local" className={inputClass} value={e.end} onChange={(ev) => set("end", ev.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Équipe")}</p>
          <div className="flex flex-wrap gap-2">
            {data.members
              .filter((m) => m.active)
              .map((m) => {
                const on = e.memberIds.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => set("memberIds", on ? e.memberIds.filter((x) => x !== m.id) : [...e.memberIds, m.id])} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-400")}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} /> {m.name}
                  </button>
                );
              })}
            {!data.members.length && <span className="text-sm text-slate-500">{t("Ajoutez votre équipe dans l'onglet Équipe.")}</span>}
          </div>
        </div>
        {data.vehicles.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Véhicules")}</p>
            <div className="flex flex-wrap gap-2">
              {data.vehicles.map((v) => {
                const on = (e.vehicleIds ?? []).includes(v.id);
                return (
                  <button key={v.id} type="button" onClick={() => set("vehicleIds", on ? (e.vehicleIds ?? []).filter((x) => x !== v.id) : [...(e.vehicleIds ?? []), v.id])} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-400")}>
                    <Truck className="h-3.5 w-3.5" /> {v.plate}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {e.kind === "leave" && (
          <Field label={t("Statut de la demande")}>
            <select className={inputClass} value={e.status} onChange={(ev) => set("status", ev.target.value as PlanningEvent["status"])}>
              <option value="requested">{t("Demandé")}</option>
              <option value="approved">{t("Approuvé")}</option>
              <option value="refused">{t("Refusé")}</option>
            </select>
          </Field>
        )}
        {e.kind !== "leave" && (
          <Field label={t("Statut")}>
            <select className={inputClass} value={e.status} onChange={(ev) => set("status", ev.target.value as PlanningEvent["status"])}>
              <option value="planned">{t("Planifié")}</option>
              <option value="done">{t("Fait")}</option>
              <option value="cancelled">{t("Annulé")}</option>
            </select>
          </Field>
        )}
        <Field label={t("Notes")} className="sm:col-span-2">
          <textarea rows={3} className={inputClass} value={e.notes} onChange={(ev) => set("notes", ev.target.value)} />
        </Field>
        {clash.length > 0 && (
          <div className="sm:col-span-2">
            <Notice tone="warn">
              {t("Conflit d'affectation")} :{" "}
              {clash.map((c) => `${c.memberId ? name(c.memberId) : data.vehicles.find((v) => v.id === c.vehicleId)?.plate} — ${c.event.title} (${f.date(c.event.start.slice(0, 10))})`).join(" · ")}
            </Notice>
          </div>
        )}
      </div>
    </Modal>
  );
}

export const blankEvent = (day: string, p: Partial<PlanningEvent> = {}): PlanningEvent => ({ id: uid(), kind: "job", title: "", jobId: null, clientId: null, memberIds: [], start: `${day}T08:00`, end: `${day}T16:00`, notes: "", status: "planned", ...p });

/** Page Planning : agenda des équipes et calendrier des intempéries. */
export function PlanningTab({ view, onView }: { view?: string; onView?: (v: string) => void }) {
  const { t } = useTr();
  const { data } = useAppData();
  const [local, setLocal] = useState(view === "intemperies" || view === "gantt" ? view : "agenda");
  const current = view === "intemperies" || view === "agenda" || view === "gantt" ? view : local;
  const toJustify = data.weatherDays.filter(needsProof).length;
  const change = (v: string) => (setLocal(v), onView?.(v));
  return (
    <div>
      <div className="mb-5">
        <SubTabs
          tabs={[
            { id: "agenda", label: t("Agenda") },
            { id: "gantt", label: t("Gantt") },
            { id: "intemperies", label: t("Intempéries"), count: toJustify || undefined },
          ]}
          value={current}
          onChange={change}
        />
      </div>
      {current === "gantt" ? (
        <>
          <PageHeader title={t("Planning des chantiers")} subtitle={t("Tous les chantiers sur une frise : chevauchements, conflits d'équipe et charge de travail.")} />
          <GanttTab />
        </>
      ) : current === "intemperies" ? (
        <>
          <PageHeader title={t("Intempéries")} subtitle={t("Jours de chantier arrêtés ou ralentis par la météo, avec preuve IRM.")} />
          <WeatherTab />
        </>
      ) : (
        <Agenda />
      )}
    </div>
  );
}

function Agenda() {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const [monday, setMonday] = useState(mondayOf(todayIso()));
  const [editing, setEditing] = useState<PlanningEvent | null>(null);
  const [weather, setWeather] = useState<DayWeather[] | null>(null);
  const [weatherErr, setWeatherErr] = useState(false);
  const days = weekDays(monday);
  const members = data.members.filter((m) => m.active);
  const today = todayIso();

  useEffect(() => {
    const city = data.company.address.city;
    if (!city) return;
    fetchWeather(city, data.company.address.postcode)
      .then(setWeather)
      .catch(() => setWeatherErr(true));
  }, [data.company.address.city, data.company.address.postcode]);

  const rows = useMemo(
    () => [
      ...members.map((m) => ({ row: { type: "member" as const, id: m.id }, name: m.name, color: m.color })),
      ...data.vehicles.map((v) => ({ row: { type: "vehicle" as const, id: v.id }, name: `${v.plate}`, color: "#64748b" })),
      { row: { type: "none" as const, id: "" }, name: t("Non assigné"), color: "#475569" },
    ],
    [members, data.vehicles, t],
  );
  const eventsFor = (row: PlanningRow, day: string) =>
    data.events.filter(
      (e) =>
        e.status !== "cancelled" &&
        e.status !== "refused" &&
        onDay(e, day) &&
        (row.type === "member" ? e.memberIds.includes(row.id) : row.type === "vehicle" ? (e.vehicleIds ?? []).includes(row.id) : !e.memberIds.length && !(e.vehicleIds ?? []).length),
    );
  const [drag, setDrag] = useState<{ id: string; row: PlanningRow; day: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const drop = (row: PlanningRow, day: string) => {
    const e = data.events.find((x) => x.id === drag?.id);
    if (e && drag && (drag.day !== day || drag.row.type !== row.type || drag.row.id !== row.id)) upsert("events", moveEvent(e, drag, { row, day }));
    setDrag(null);
    setOver(null);
  };
  const leaveRequests = data.events.filter((e) => e.kind === "leave" && e.status === "requested");
  const w = (day: string) => weather?.find((x) => x.date === day);
  const riskyJobs = days.flatMap((day) =>
    data.events
      .filter((e) => e.kind === "job" && onDay(e, day) && e.status === "planned")
      .filter((e) => data.jobs.find((j) => j.id === e.jobId)?.weatherSensitive && w(day) && badWeather(w(day)!))
      .map((e) => ({ e, day })),
  );

  return (
    <div>
      <PageHeader
        title={t("Planning")}
        subtitle={`${f.date(days[0])} → ${f.date(days[6])}`}
        actions={
          <>
            <div className="flex items-center rounded-xl border border-white/10 p-1">
              <button onClick={() => setMonday(addDays(monday, -7))} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label={t("Semaine précédente")}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setMonday(mondayOf(today))} className="px-3 text-sm text-slate-300">
                {t("Cette semaine")}
              </button>
              <button onClick={() => setMonday(addDays(monday, 7))} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label={t("Semaine suivante")}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => downloadBlob(new Blob([toIcs(data.events.filter((e) => days.some((d) => onDay(e, d))), data)], { type: "text/calendar" }), `planning-${monday}.ics`)} className="btn-ghost !py-2.5 text-sm" title={t("Importer dans Google Agenda, Outlook ou Apple Calendrier")}>
              <Download className="h-4 w-4" /> .ics
            </button>
            <button onClick={() => setEditing(blankEvent(today < days[0] || today > days[6] ? days[0] : today))} className="btn-primary !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Planifier")}
            </button>
          </>
        }
      />

      {riskyJobs.length > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            <CloudRain className="mr-1 inline h-4 w-4" />
            {t("Météo défavorable pour des travaux extérieurs")} : {riskyJobs.map((r) => `${r.e.title} (${f.date(r.day)})`).join(" · ")}
          </Notice>
        </div>
      )}
      {leaveRequests.length > 0 && (
        <div className="card mb-4 space-y-2 p-4">
          <p className="text-sm font-semibold text-white">{t("Demandes de congé à valider")}</p>
          {leaveRequests.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex-1 text-slate-300">
                {e.memberIds.map((id) => data.members.find((m) => m.id === id)?.name).join(", ")} — {f.date(e.start.slice(0, 10))} → {f.date(e.end.slice(0, 10))}
              </span>
              <button onClick={() => upsert("events", { ...e, status: "approved" })} className="btn-primary !px-3 !py-1.5 text-xs">
                <Check className="h-3.5 w-3.5" /> {t("Approuver")}
              </button>
              <button onClick={() => upsert("events", { ...e, status: "refused" })} className="btn-ghost !px-3 !py-1.5 text-xs">
                <X className="h-3.5 w-3.5" /> {t("Refuser")}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="w-36 p-3 text-left text-xs uppercase tracking-wider text-slate-500">{t("Équipe")}</th>
              {days.map((d) => {
                const wd = w(d);
                return (
                  <th key={d} className={cn("p-3 text-left font-semibold", d === today ? "text-cyan" : "text-slate-300")}>
                    <span className="block text-xs uppercase">{new Date(`${d}T12:00`).toLocaleDateString(f.locale, { weekday: "short" })}</span>
                    <span className="flex items-center gap-1.5">
                      {new Date(`${d}T12:00`).toLocaleDateString(f.locale, { day: "numeric", month: "short" })}
                      {wd && (
                        <span className={cn("flex items-center gap-0.5 text-[11px] font-normal", badWeather(wd) ? "text-amber-300" : "text-slate-500")} title={`${wd.rain} mm · ${wd.wind} km/h`}>
                          {badWeather(wd) ? <CloudRain className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                          {Math.round(wd.tmax)}°
                        </span>
                      )}
                    </span>
                    {holidayName(d) && <span className="block truncate text-[11px] font-normal text-slate-400">{t(holidayName(d)!)}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={`${r.row.type}-${r.row.id}`}>
                <td className="p-3 align-top">
                  <span className="flex items-center gap-2 font-medium text-slate-200">
                    {r.row.type === "vehicle" ? <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />}
                    <span className="truncate">{r.name}</span>
                  </span>
                </td>
                {days.map((d) => (
                  <td
                    key={d}
                    onDragOver={(ev) => {
                      ev.preventDefault();
                      setOver(`${r.row.type}-${r.row.id}-${d}`);
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={() => drop(r.row, d)}
                    className={cn("group h-20 p-1.5 align-top transition-colors", d === today && "bg-cyan/[0.03]", over === `${r.row.type}-${r.row.id}-${d}` && "bg-cyan/10 ring-1 ring-inset ring-cyan/50")}
                  >
                    <div className="space-y-1">
                      {eventsFor(r.row, d).map((e) => (
                        <button
                          key={e.id}
                          draggable
                          onDragStart={() => setDrag({ id: e.id, row: r.row, day: d })}
                          onDragEnd={() => (setDrag(null), setOver(null))}
                          onClick={() => setEditing(e)}
                          className={cn("theme-fixed block w-full cursor-grab truncate rounded-lg px-2 py-1 text-left text-xs font-medium text-white active:cursor-grabbing", e.status === "requested" && "opacity-60 ring-1 ring-dashed ring-amber-300", e.status === "done" && "opacity-50 line-through")}
                          style={{ background: `${EVENT_KIND[e.kind].color}cc` }}
                          title={`${e.title} · ${e.start.slice(11)}–${e.end.slice(11)}`}
                        >
                          {conflicts(data, e).length > 0 && <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-200" />}
                          {e.title}
                        </button>
                      ))}
                      <button onClick={() => setEditing(blankEvent(d, { memberIds: r.row.type === "member" ? [r.row.id] : [], vehicleIds: r.row.type === "vehicle" ? [r.row.id] : [] }))} className="hidden w-full rounded-lg border border-dashed border-white/10 py-1 text-xs text-slate-500 hover:border-cyan/50 hover:text-cyan group-hover:block" aria-label={t("Planifier")}>
                        +
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        {(Object.keys(EVENT_KIND) as EventKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EVENT_KIND[k].color }} /> {t(EVENT_KIND[k].label)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3" /> {weatherErr ? t("Météo indisponible") : t("Météo : Open-Meteo, localité du siège")}
        </span>
      </div>
      <AnimatePresence>{editing && <EventForm event={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
