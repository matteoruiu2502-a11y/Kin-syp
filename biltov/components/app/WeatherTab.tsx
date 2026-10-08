"use client";

// Calendrier des intempéries : jours de chantier interrompus ou ralentis par la météo, avec preuve IRM.
// Vues mois / semaine / liste, fiche en 3 gestes (chantier → type → enregistrer), preuves avec empreinte,
// pré-remplissage indicatif Open-Meteo, journal des modifications, rapport PDF et CSV.

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  Download,
  FileText,
  Fingerprint,
  History,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  ShieldCheck,
  Snowflake,
  ThermometerSnowflake,
  ThermometerSun,
  Trash2,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useAppData, compressImage } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { todayIso, uid } from "@/lib/app/defaults";
import { downloadBlob } from "@/lib/app/send";
import { cn } from "@/lib/utils";
import {
  DURATION_LABEL,
  IMPACT_LABEL,
  KIND_LABEL,
  STATUS_LABEL,
  WEATHER_KINDS,
  computeHoursLost,
  coversDay,
  delayDays,
  describeChanges,
  displayStatus,
  fetchHistoricalWeather,
  geocodeBE,
  jobWeatherSummary,
  needsProof,
  newWeatherDay,
  nextStatus,
  placeOf,
  sha256,
  weatherCsv,
} from "@/lib/app/weather";
import { addWorkdays, dayOff, eachDay, plusDays, weekday } from "@/lib/app/workdays";
import type { Job, Photo, WeatherDay, WeatherDuration, WeatherImpact, WeatherKind, WeatherProof, WeatherStatus } from "@/lib/app/types";
import { Field, Modal, Notice, PageHeader, SubTabs, inputClass } from "./ui";

export const KIND_ICON: Record<WeatherKind, LucideIcon> = {
  rain: CloudRain,
  heavy_rain: CloudRainWind,
  storm: CloudLightning,
  frost: ThermometerSnowflake,
  snow: CloudSnow,
  ice: Snowflake,
  wind: Wind,
  heat: ThermometerSun,
  fog: CloudFog,
  other: CircleHelp,
};

/** Statut : couleur réservée au statut + icône + libellé (jamais la couleur seule). */
const STATUS_STYLE: Record<WeatherStatus | "to_justify", { cls: string; icon: LucideIcon }> = {
  to_justify: { cls: "border-amber-400/40 bg-amber-400/10 text-amber-300", icon: AlertTriangle },
  draft: { cls: "border-white/10 text-slate-300", icon: FileText },
  justified: { cls: "border-blue/40 bg-blue/10 text-cyan", icon: Paperclip },
  validated: { cls: "border-emerald/40 bg-emerald/10 text-emerald", icon: ShieldCheck },
};

export function StatusPill({ w }: { w: WeatherDay }) {
  const { t } = useTr();
  const s = displayStatus(w);
  const { cls, icon: Icon } = STATUS_STYLE[s];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", cls)}>
      <Icon className="h-3 w-3" /> {t(STATUS_LABEL[s])}
    </span>
  );
}

const MAX_PROOF = 10 * 1024 * 1024;
/** JJ/MM/AAAA HH:MM, heure de Bruxelles. */
const DT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" };
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const monthEnd = (day: string) => plusDays(`${plusDays(`${day.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1);
const mondayOf = (day: string) => plusDays(day, -weekday(day));

type View = "month" | "week" | "list";
type StatusFilter = "all" | "to_justify" | "justified" | "validated";

/** Chantiers en cours ce jour-là (dates prévues). */
const activeJobs = (jobs: Job[], day: string) => jobs.filter((j) => ["accepted", "in_progress"].includes(j.status) && j.startDate && j.startDate <= day && (j.endDate || j.startDate) >= day);

export function WeatherTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, can, getBlob, isDemo, actor } = useAppData();
  const canEdit = can("planning", "edit") || can("worker", "edit");
  const today = todayIso();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(today);
  const [jobFilter, setJobFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<WeatherKind | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [listFrom, setListFrom] = useState(plusDays(today, -90));
  const [listTo, setListTo] = useState(today);
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState<WeatherDay | null>(null);
  const [busy, setBusy] = useState(false);

  const [from, to] = view === "month" ? [monthStart(cursor), monthEnd(cursor)] : view === "week" ? [mondayOf(cursor), plusDays(mondayOf(cursor), 6)] : [listFrom, listTo];
  const cal = data.settings.planning;
  const filtered = useMemo(
    () =>
      data.weatherDays.filter(
        (w) =>
          (!jobFilter || w.jobIds.includes(jobFilter)) &&
          (!kindFilter || w.kind === kindFilter) &&
          (statusFilter === "all" || displayStatus(w) === statusFilter),
      ),
    [data.weatherDays, jobFilter, kindFilter, statusFilter],
  );
  const inPeriod = filtered.filter((w) => w.start <= to && (w.end || w.start) >= from).sort((a, b) => b.start.localeCompare(a.start));
  const toJustify = data.weatherDays.filter(needsProof).length;
  const jobName = (id: string) => data.jobs.find((j) => j.id === id)?.name ?? "?";
  const visibleJobs = data.jobs.filter((j) => ["accepted", "in_progress", "done"].includes(j.status));

  const step = (n: number) => setCursor(view === "month" ? `${plusDays(`${cursor.slice(0, 7)}-15`, n * 30).slice(0, 7)}-01` : plusDays(cursor, 7 * n));
  const create = (day: string) => setEditing(newWeatherDay({ start: day, end: day, jobIds: jobFilter ? [jobFilter] : [], createdBy: actor?.name ?? (data.company.owner || t("Titulaire du compte")), createdById: actor?.id ?? null }));

  const exportPdf = async () => {
    setBusy(true);
    try {
      const { buildWeatherReport } = await import("@/lib/app/pdf");
      const job = jobFilter ? (data.jobs.find((j) => j.id === jobFilter) ?? null) : null;
      const pdf = await buildWeatherReport({ days: inPeriod, job, from, to, author: actor?.name ?? (data.company.owner || data.company.name) }, data, getBlob, isDemo ? "DÉMONSTRATION" : undefined);
      pdf.save(`intemperies-${job ? job.name.normalize("NFD").replace(/[^\w-]+/g, "-") + "-" : ""}${from}_${to}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const title = view === "month" ? new Date(`${cursor.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(f.locale, { month: "long", year: "numeric" }) : `${f.date(from)} – ${f.date(to)}`;

  return (
    <div>
      {toJustify > 0 && (
        <button onClick={() => (setStatusFilter("to_justify"), setView("list"), setListFrom("2000-01-01"))} className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("{n} intempérie(s) sans preuve météo : à justifier", { n: toJustify })}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SubTabs
          tabs={[
            { id: "month", label: t("Mois") },
            { id: "week", label: t("Semaine") },
            { id: "list", label: t("Liste") },
          ]}
          value={view}
          onChange={setView}
        />
        {view !== "list" && (
          <div className="flex items-center rounded-xl border border-white/10 p-1">
            <button onClick={() => step(-1)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label={t("Précédent")}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCursor(today)} className="px-2 text-sm text-slate-300 sm:px-3">
              {t("Aujourd'hui")}
            </button>
            <button onClick={() => step(1)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label={t("Suivant")}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <button onClick={exportPdf} disabled={busy} className="btn-ghost !py-2.5 text-sm" title={t("Rapport PDF de la période affichée")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </button>
          <button onClick={() => downloadBlob(new Blob([weatherCsv(inPeriod, data)], { type: "text/csv;charset=utf-8" }), `intemperies-${from}_${to}.csv`)} className="btn-ghost !py-2.5 text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
          {canEdit && (
            <button onClick={() => create(today)} className="btn-primary w-full !py-2.5 text-sm sm:w-auto">
              <Plus className="h-4 w-4" /> {t("Déclarer une intempérie")}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className={inputClass} aria-label={t("Chantier")}>
          <option value="">{t("Tous les chantiers")}</option>
          {visibleJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as WeatherKind | "")} className={inputClass} aria-label={t("Type")}>
          <option value="">{t("Tous les types")}</option>
          {WEATHER_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(KIND_LABEL[k])}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={inputClass} aria-label={t("Statut")}>
          <option value="all">{t("Tous les statuts")}</option>
          <option value="to_justify">{t("À justifier")}</option>
          <option value="justified">{t("Justifié")}</option>
          <option value="validated">{t("Validé")}</option>
        </select>
      </div>

      {jobFilter && <JobWeatherSummary jobId={jobFilter} />}

      <h2 className="mb-3 font-display text-lg font-bold capitalize text-white">{title}</h2>

      {view === "month" && (
        <MonthGrid
          from={from}
          to={to}
          entries={filtered}
          picked={picked}
          onPick={(d) => setPicked(picked === d ? null : d)}
        />
      )}
      {view === "month" && picked && (
        <DayPanel day={picked} entries={filtered.filter((w) => coversDay(w, picked))} onOpen={setEditing} onAdd={canEdit ? () => create(picked) : undefined} />
      )}
      {view === "week" && (
        <div className="space-y-2">
          {eachDay(from, to).map((d) => (
            <DayPanel key={d} day={d} entries={filtered.filter((w) => coversDay(w, d))} onOpen={setEditing} onAdd={canEdit ? () => create(d) : undefined} compact />
          ))}
        </div>
      )}
      {view === "list" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:max-w-md">
            <Field label={t("Du")}>
              <input type="date" value={listFrom} onChange={(e) => setListFrom(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("Au")}>
              <input type="date" value={listTo} min={listFrom} onChange={(e) => setListTo(e.target.value)} className={inputClass} />
            </Field>
          </div>
          {inPeriod.length ? (
            <div className="space-y-2">
              {inPeriod.map((w) => (
                <EntryRow key={w.id} w={w} onOpen={() => setEditing(w)} jobName={jobName} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">{t("Aucune intempérie sur cette période.")}</p>
          )}
        </>
      )}

      <Legend />
      {cal?.constructionLeaves.some((l) => l.label.includes("à vérifier")) && (
        <p className="mt-2 text-xs text-slate-500">{t("Congés du bâtiment : dates proposées par défaut, à vérifier dans Paramètres → Calendrier.")}</p>
      )}

      {editing && <WeatherForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Legend() {
  const { t } = useTr();
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-[repeating-linear-gradient(135deg,rgb(148_163_184/0.25)_0_3px,transparent_3px_6px)] ring-1 ring-white/10" /> {t("Week-end")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-slate-400/25 ring-1 ring-white/10" /> {t("Jour férié")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-blue/15 ring-1 ring-blue/30" /> {t("Congé du bâtiment")}
      </span>
      {(["to_justify", "justified", "validated"] as const).map((s) => {
        const { icon: Icon, cls } = STATUS_STYLE[s];
        return (
          <span key={s} className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5", cls)}>
            <Icon className="h-3 w-3" /> {t(STATUS_LABEL[s])}
          </span>
        );
      })}
    </div>
  );
}

function offClass(kind: "weekend" | "holiday" | "leave" | undefined) {
  return kind === "weekend"
    ? "bg-[repeating-linear-gradient(135deg,rgb(148_163_184/0.08)_0_4px,transparent_4px_8px)]"
    : kind === "holiday"
      ? "bg-slate-400/10"
      : kind === "leave"
        ? "bg-blue/[0.07]"
        : "";
}

function MonthGrid({ from, to, entries, picked, onPick }: { from: string; to: string; entries: WeatherDay[]; picked: string | null; onPick: (d: string) => void }) {
  const { t } = useTr();
  const { data } = useAppData();
  const today = todayIso();
  const cal = data.settings.planning;
  const start = mondayOf(from);
  const end = plusDays(mondayOf(to), 6);
  const days = eachDay(start, end);
  const heads = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02] text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {heads.map((h) => (
          <div key={h} className="py-2">
            {t(h)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const off = dayOff(d, cal);
          const list = entries.filter((w) => coversDay(w, d));
          const jobs = activeJobs(data.jobs, d).length;
          const outside = d < from || d > to;
          const missing = list.some(needsProof);
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              aria-label={`${d}${off ? ` — ${off.label}` : ""}${list.length ? ` — ${list.length} intempérie(s)` : ""}`}
              aria-pressed={picked === d}
              className={cn(
                "relative flex min-h-[64px] flex-col items-start gap-1 border-b border-r border-white/5 p-1.5 text-left transition-colors hover:bg-white/[0.04] sm:min-h-[92px] sm:p-2",
                offClass(off?.kind),
                outside && "opacity-40",
                picked === d && "ring-2 ring-inset ring-blue",
              )}
            >
              <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold", d === today ? "bg-blue text-white" : "text-slate-300")}>{Number(d.slice(8))}</span>
              {off && off.kind !== "weekend" && <span className="hidden max-w-full truncate text-[10px] text-slate-400 sm:block">{t(off.label)}</span>}
              <span className="flex flex-wrap gap-0.5">
                {list.slice(0, 3).map((w) => {
                  const Icon = KIND_ICON[w.kind];
                  return <Icon key={w.id} className={cn("h-4 w-4", needsProof(w) ? "text-amber-300" : "text-slate-200")} aria-hidden />;
                })}
                {list.length > 3 && <span className="text-[10px] text-slate-400">+{list.length - 3}</span>}
              </span>
              {missing && <AlertTriangle className="absolute right-1 top-1 h-3.5 w-3.5 text-amber-300" aria-label={t("À justifier")} />}
              {jobs > 0 && <span className="mt-auto hidden text-[10px] text-slate-500 sm:block">{t("{n} chantier(s)", { n: jobs })}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayPanel({ day, entries, onOpen, onAdd, compact }: { day: string; entries: WeatherDay[]; onOpen: (w: WeatherDay) => void; onAdd?: () => void; compact?: boolean }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const off = dayOff(day, data.settings.planning);
  const jobs = activeJobs(data.jobs, day);
  const jobName = (id: string) => data.jobs.find((j) => j.id === id)?.name ?? "?";
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString(f.locale, { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className={cn("rounded-2xl border border-white/10 p-3", compact ? offClass(off?.kind) : "mt-3", day === todayIso() && "ring-1 ring-blue")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold capitalize text-white">{label}</p>
        {off && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">{t(off.label)}</span>}
        {onAdd && (
          <button onClick={onAdd} className="ml-auto flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-cyan hover:bg-white/5">
            <Plus className="h-4 w-4" /> {t("Intempérie")}
          </button>
        )}
      </div>
      {jobs.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {t("Chantiers en cours")} : {jobs.map((j) => j.name).join(" · ")}
        </p>
      )}
      {entries.length > 0 && (
        <div className="mt-2 space-y-2">
          {entries.map((w) => (
            <EntryRow key={w.id} w={w} onOpen={() => onOpen(w)} jobName={jobName} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({ w, onOpen, jobName }: { w: WeatherDay; onOpen: () => void; jobName: (id: string) => string }) {
  const { t } = useTr();
  const f = useFmt();
  const Icon = KIND_ICON[w.kind];
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.05]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-slate-200">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-white">{t(KIND_LABEL[w.kind])}</span>
          <StatusPill w={w} />
        </span>
        <span className="block truncate text-xs text-slate-400">
          {f.date(w.start)}
          {w.end && w.end !== w.start ? ` → ${f.date(w.end)}` : ""} · {w.duration === "hours" ? `${w.fromTime}–${w.toTime}` : t(DURATION_LABEL[w.duration])} · {t(IMPACT_LABEL[w.impact])}
        </span>
        <span className="block truncate text-xs text-slate-500">{w.jobIds.map(jobName).join(" · ") || t("Aucun chantier")}</span>
      </span>
      {w.hoursLost > 0 && <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-amber-300">{f.num(w.hoursLost, 1)} h</span>}
    </button>
  );
}

/** Compteurs d'intempéries d'un chantier (fiche chantier, calendrier filtré). */
export function JobWeatherSummary({ jobId, onOpen }: { jobId: string; onOpen?: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const s = jobWeatherSummary(data, jobId);
  if (!s.count) return null;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        [t("Jours d'intempérie"), String(s.days), ""],
        [t("Retard imputable à la météo"), `${f.num(s.delay, 1)} ${t("j")}`, "text-amber-300"],
        [t("Heures perdues"), `${f.num(s.hours, 1)} h`, ""],
        [t("Justifiés / à justifier"), `${s.justified} / ${s.toJustify}`, s.toJustify ? "text-amber-300" : "text-emerald"],
      ].map(([label, value, cls]) => (
        <button key={label} onClick={onOpen} disabled={!onOpen} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left disabled:cursor-default">
          <span className="block text-xs text-slate-400">{label}</span>
          <span className={cn("font-display text-lg font-bold tabular-nums text-white", cls)}>{value}</span>
        </button>
      ))}
    </div>
  );
}

/** Rappel du tableau de bord : intempéries sans preuve. */
export function WeatherReminder({ onOpen }: { onOpen: () => void }) {
  const { t } = useTr();
  const { data, can } = useAppData();
  const n = data.weatherDays.filter(needsProof).length;
  if (!n || !can("planning")) return null;
  return (
    <button onClick={onOpen} className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-300">
      <CloudRain className="h-4 w-4 shrink-0" />
      <span className="flex-1">{t("{n} intempérie(s) sans preuve météo : à justifier", { n })}</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

// ── Fiche « jour d'intempérie » ──────────────────────────────────────────────

const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function WeatherForm({ initial, onClose, worker }: { initial: WeatherDay; onClose: () => void; worker?: boolean }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, remove, putBlob, blobUrl, actor, can } = useAppData();
  const cal = data.settings.planning;
  const isNew = !data.weatherDays.some((w) => w.id === initial.id);
  const [w, setW] = useState<WeatherDay>(initial);
  const [manualHours, setManualHours] = useState(!isNew && initial.hoursLost !== computeHoursLost(initial, cal));
  const [more, setMore] = useState(!isNew);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "danger"; text: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [link, setLink] = useState({ url: "", consultedAt: new Date().toISOString().slice(0, 16) });
  const [pending, setPending] = useState<Record<string, Blob>>({}); // fichiers ajoutés, enregistrés à la validation
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  // dans l'espace ouvrier, l'auteur est l'ouvrier connecté
  const user = worker ? initial.createdBy : (actor?.name ?? (data.company.owner || t("Titulaire du compte")));
  const locked = initial.status === "validated" && !isAdmin();
  const canDelete = !isNew && can("planning", "edit") && initial.status !== "validated";

  function isAdmin() {
    return !actor || actor.role === "owner" || (actor.role === "admin" && can("planning", "edit"));
  }

  const set = <K extends keyof WeatherDay>(k: K, v: WeatherDay[K]) => setW((x) => ({ ...x, [k]: v }));
  const hours = manualHours ? w.hoursLost : computeHoursLost(w, cal);

  // chantiers proposés : en cours à cette date d'abord (ou ceux de l'ouvrier)
  const jobs = data.jobs.filter((j) => !["lost", "refused"].includes(j.status) && (!worker || j.memberIds.includes(initial.createdById ?? "") || initial.jobIds.includes(j.id)));
  const active = new Set(activeJobs(jobs, w.start).map((j) => j.id));
  const jobList = [...jobs].sort((a, b) => Number(active.has(b.id)) - Number(active.has(a.id)) || a.name.localeCompare(b.name));
  const members = data.members.filter((m) => m.active && m.role !== "accountant" && m.role !== "secretary");

  const toggleJob = (id: string) => {
    const ids = w.jobIds.includes(id) ? w.jobIds.filter((x) => x !== id) : [...w.jobIds, id];
    // ouvriers impactés proposés : l'équipe des chantiers choisis
    const team = [...new Set(ids.flatMap((j) => data.jobs.find((x) => x.id === j)?.memberIds ?? []))];
    setW((x) => ({ ...x, jobIds: ids, memberIds: x.memberIds.length && w.jobIds.length ? x.memberIds : team }));
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: WeatherProof[] = [];
    const blobs: Record<string, Blob> = {};
    for (const file of Array.from(files)) {
      if (file.size > MAX_PROOF) {
        setMsg({ tone: "danger", text: t("« {name} » dépasse 10 Mo : réduisez-le ou faites une capture d'écran.", { name: file.name }) });
        continue;
      }
      const id = uid();
      blobs[id] = file; // fichier d'origine, non recompressé : l'empreinte doit correspondre à la preuve reçue
      added.push({ id, kind: "file", name: file.name, mime: file.type || "application/octet-stream", size: file.size, sha256: await sha256(file), url: link.url.trim(), consultedAt: link.url.trim() ? new Date(link.consultedAt).toISOString() : "", addedAt: new Date().toISOString(), addedBy: user });
    }
    setPending((p) => ({ ...p, ...blobs }));
    setW((x) => ({ ...x, proofs: [...x.proofs, ...added] }));
  };

  const addLink = () => {
    const url = link.url.trim();
    if (!/^https?:\/\//i.test(url)) return setMsg({ tone: "warn", text: t("Collez un lien complet (https://…).") });
    setW((x) => ({ ...x, proofs: [...x.proofs, { id: uid(), kind: "link", name: url.replace(/^https?:\/\//, "").slice(0, 60), mime: "", size: 0, sha256: "", url, consultedAt: new Date(link.consultedAt).toISOString(), addedAt: new Date().toISOString(), addedBy: user }] }));
    setLink((l) => ({ ...l, url: "" }));
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const jobId = w.jobIds[0];
    if (!jobId) return setMsg({ tone: "warn", text: t("Choisissez d'abord le chantier.") });
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      const { blob, width, height } = await compressImage(file);
      const photo: Photo = { id: uid(), jobId, phase: "pendant", caption: `${t(KIND_LABEL[w.kind])} — ${f.date(w.start)}`, takenAt: new Date(file.lastModified || Date.now()).toISOString(), addedAt: new Date().toISOString(), width, height, geo: null };
      await putBlob(`photo:${photo.id}`, blob);
      upsert("photos", photo);
      ids.push(photo.id);
    }
    setW((x) => ({ ...x, photoIds: [...x.photoIds, ...ids] }));
  };

  const prefill = async () => {
    setFetching(true);
    setMsg(null);
    try {
      const job = data.jobs.find((j) => j.id === w.jobIds[0]);
      let geo = job?.geo ?? null;
      if (!geo) {
        geo = await geocodeBE(placeOf(job, data).city);
        if (geo && job && can("jobs", "edit")) upsert("jobs", { ...job, geo });
      }
      if (!geo) throw new Error("geo");
      const m = await fetchHistoricalWeather(geo.lat, geo.lng, w.start, w.end || w.start);
      if (!m) throw new Error("none");
      setW((x) => ({ ...x, measures: { ...m, source: "open-meteo" } }));
      setMsg({ tone: "ok", text: t("Valeurs indicatives Open-Meteo pour {place}. La preuve officielle reste le document IRM joint.", { place: geo.label }) });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as Error).message === "geo" ? t("Localité du chantier introuvable : complétez l'adresse (code postal et commune) ou saisissez les valeurs.") : t("Données météo indisponibles (pas de connexion ou période non couverte). Saisissez les valeurs à la main.") });
    } finally {
      setFetching(false);
    }
  };

  const save = async (status?: WeatherStatus) => {
    if (!w.jobIds.length) return setMsg({ tone: "warn", text: t("Choisissez au moins un chantier.") });
    if (w.end && w.end < w.start) return setMsg({ tone: "warn", text: t("La date de fin doit suivre la date de début.") });
    if (w.duration === "hours" && !(w.toTime > w.fromTime)) return setMsg({ tone: "warn", text: t("L'heure de fin doit suivre l'heure de début.") });
    for (const [id, blob] of Object.entries(pending)) await putBlob(`proof:${id}`, blob);
    let next: WeatherDay = { ...w, end: w.end || w.start, hoursLost: hours };
    next = { ...next, status: status ?? nextStatus(next) };
    if (status === "validated") next.validatedBy = user;
    const names = { job: (id: string) => data.jobs.find((j) => j.id === id)?.name ?? "?", member: (id: string) => data.members.find((m) => m.id === id)?.name ?? "?" };
    const detail = isNew ? `${KIND_LABEL[next.kind]}, ${next.jobIds.map(names.job).join(", ")}` : describeChanges(initial, next, names);
    if (!isNew && !detail) return onClose();
    next.history = [...initial.history, { at: new Date().toISOString(), user, action: isNew ? "Création" : status === "validated" ? "Validation" : "Modification", detail }];
    try {
      upsert("weatherDays", next);
    } catch {
      return; // droits insuffisants : message global affiché par l'application
    }
    // décaler la fin prévue des chantiers (toujours sur confirmation)
    const extra = delayDays(next, cal) - (isNew ? 0 : delayDays(initial, cal));
    if (extra >= 0.5 && can("jobs", "edit")) {
      for (const id of next.jobIds) {
        const job = data.jobs.find((j) => j.id === id);
        if (!job?.endDate || job.status === "done") continue;
        const n = Math.ceil(extra);
        const end = addWorkdays(job.endDate, n, cal);
        if (window.confirm(t("Décaler la fin prévue de « {job} » de {n} jour(s) ouvrable(s) ({from} → {to}) ?", { job: job.name, n, from: f.date(job.endDate), to: f.date(end) }))) upsert("jobs", { ...job, endDate: end });
      }
    }
    onClose();
  };

  const del = () => {
    if (!window.confirm(t("Supprimer cette intempérie ? Les preuves jointes seront retirées du rapport."))) return;
    remove("weatherDays", w.id);
    onClose();
  };

  const openProof = async (p: WeatherProof) => {
    if (p.kind === "link") return window.open(p.url, "_blank", "noopener");
    const url = pending[p.id] ? URL.createObjectURL(pending[p.id]) : await blobUrl(`proof:${p.id}`);
    if (url) window.open(url, "_blank", "noopener");
  };

  const chip = (on: boolean) => cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors", on ? "border-blue bg-blue text-white" : "border-white/10 text-slate-300 hover:bg-white/5");

  return (
    <Modal
      title={isNew ? t("Déclarer une intempérie") : t("Intempérie du {date}", { date: f.date(w.start) })}
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {canDelete && (
            <button onClick={del} className="btn-ghost !px-3 text-sm text-rose-300" aria-label={t("Supprimer")}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <span className="ml-auto" />
          {!isNew && isAdmin() && w.status !== "validated" && w.proofs.length > 0 && (
            <button onClick={() => save("validated")} className="btn-ghost text-sm">
              <ShieldCheck className="h-4 w-4" /> {t("Valider")}
            </button>
          )}
          {!locked && (
            <button onClick={() => save()} className="btn-primary text-sm">
              <CheckCircle2 className="h-4 w-4" /> {t("Enregistrer")}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {!isNew && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <StatusPill w={w} />
            <span>{t("Déclarée par {name} le {date}", { name: w.createdBy, date: new Date(w.createdAt).toLocaleString(f.locale, DT) })}</span>
          </div>
        )}
        {locked && <Notice tone="ok">{t("Intempérie validée par {name} : seule une personne administratrice peut la modifier.", { name: w.validatedBy ?? "" })}</Notice>}
        <fieldset disabled={locked} className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-white">1. {t("Chantier(s)")}</p>
            {jobList.length ? (
              <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                {jobList.slice(0, 40).map((j) => (
                  <button type="button" key={j.id} onClick={() => toggleJob(j.id)} className={chip(w.jobIds.includes(j.id))} aria-pressed={w.jobIds.includes(j.id)}>
                    <span className="min-w-0 flex-1 truncate">{j.name}</span>
                    {active.has(j.id) && <span className="shrink-0 text-[10px] uppercase tracking-wider opacity-70">{t("en cours")}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t("Aucun chantier : créez d'abord un chantier.")}</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-white">2. {t("Type d'intempérie")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {WEATHER_KINDS.map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <button type="button" key={k} onClick={() => set("kind", k)} className={cn(chip(w.kind === k), "justify-center sm:flex-col sm:gap-1 sm:py-3")} aria-pressed={w.kind === k}>
                    <Icon className="h-5 w-5" /> {t(KIND_LABEL[k])}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Date")}>
              <input type="date" value={w.start} max={todayIso()} onChange={(e) => setW((x) => ({ ...x, start: e.target.value, end: x.end && x.end >= e.target.value ? x.end : e.target.value }))} className={inputClass} />
            </Field>
            <Field label={t("Jusqu'au (plusieurs jours)")}>
              <input type="date" value={w.end} min={w.start} onChange={(e) => set("end", e.target.value || w.start)} className={inputClass} />
            </Field>
          </div>

          {!more ? (
            <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-cyan">
              + {t("Durée, ouvriers, relevés, preuves et photos")}
            </button>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("Durée")}>
                  <select value={w.duration} onChange={(e) => set("duration", e.target.value as WeatherDuration)} className={inputClass}>
                    {(["full", "half", "hours"] as const).map((d) => (
                      <option key={d} value={d}>
                        {t(DURATION_LABEL[d])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Impact")}>
                  <select value={w.impact} onChange={(e) => set("impact", e.target.value as WeatherImpact)} className={inputClass}>
                    {(["stop", "slowed", "indoor"] as const).map((d) => (
                      <option key={d} value={d}>
                        {t(IMPACT_LABEL[d])}
                      </option>
                    ))}
                  </select>
                </Field>
                {w.duration === "hours" && (
                  <>
                    <Field label={t("De")}>
                      <input type="time" value={w.fromTime} onChange={(e) => set("fromTime", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label={t("À")}>
                      <input type="time" value={w.toTime} onChange={(e) => set("toTime", e.target.value)} className={inputClass} />
                    </Field>
                  </>
                )}
              </div>

              {members.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-white">{t("Ouvriers impactés")}</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => {
                      const on = w.memberIds.includes(m.id);
                      return (
                        <button type="button" key={m.id} onClick={() => set("memberIds", on ? w.memberIds.filter((x) => x !== m.id) : [...w.memberIds, m.id])} className={chip(on)} aria-pressed={on}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Field label={t("Heures perdues")} hint={manualHours ? t("Valeur saisie à la main.") : t("Calcul : jours ouvrables × part de journée × ouvriers (arrêt 100 %, ralenti 50 %, intérieur 0 %).")}>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" min={0} step={0.5} value={hours} onChange={(e) => (setManualHours(true), set("hoursLost", Number(e.target.value) || 0))} className={cn(inputClass, "max-w-[140px]")} />
                  {manualHours && (
                    <button type="button" onClick={() => setManualHours(false)} className="text-xs font-semibold text-cyan">
                      {t("Recalculer")}
                    </button>
                  )}
                </div>
              </Field>

              <div className="rounded-2xl border border-white/10 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">{t("Valeurs météo constatées")}</p>
                  <button type="button" onClick={prefill} disabled={fetching || !w.jobIds.length} className="ml-auto flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-cyan hover:bg-white/5 disabled:opacity-50">
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudRain className="h-4 w-4" />} {t("Pré-remplir (indicatif)")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["rainMm", t("Pluie (mm)")],
                      ["tMin", t("T° min (°C)")],
                      ["tMax", t("T° max (°C)")],
                      ["windKmh", t("Vent (km/h)")],
                    ] as const
                  ).map(([k, label]) => (
                    <Field key={k} label={label}>
                      <input
                        inputMode="decimal"
                        value={w.measures[k] ?? ""}
                        onChange={(e) => set("measures", { ...w.measures, [k]: toNum(e.target.value), source: "manual" })}
                        className={inputClass}
                      />
                    </Field>
                  ))}
                </div>
                {w.measures.source === "open-meteo" && <p className="mt-1 text-xs text-slate-500">{t("Source : Open-Meteo — valeurs indicatives, la preuve officielle est le document IRM.")}</p>}
              </div>

              <div className="rounded-2xl border border-white/10 p-3">
                <p className="text-sm font-semibold text-white">{t("Preuve météo (IRM)")}</p>
                <p className="mb-2 text-xs text-slate-400">{t("Joignez une capture, un PDF ou une photo du bulletin ou relevé IRM, et/ou le lien vers la source.")}</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_190px_auto]">
                  <input type="url" inputMode="url" placeholder="https://www.meteo.be/…" value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} className={inputClass} aria-label={t("Lien vers la source")} />
                  <input type="datetime-local" value={link.consultedAt} onChange={(e) => setLink((l) => ({ ...l, consultedAt: e.target.value }))} className={inputClass} aria-label={t("Consulté le")} />
                  <button type="button" onClick={addLink} className="btn-ghost !py-2.5 text-sm">
                    <Link2 className="h-4 w-4" /> {t("Ajouter le lien")}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost !py-2.5 text-sm">
                    <Paperclip className="h-4 w-4" /> {t("Joindre un fichier")}
                  </button>
                  <button type="button" onClick={() => photoRef.current?.click()} className="btn-ghost !py-2.5 text-sm">
                    <Camera className="h-4 w-4" /> {t("Photo du chantier")}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => (void addFiles(e.target.files), (e.target.value = ""))} />
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => (void addPhotos(e.target.files), (e.target.value = ""))} />
                </div>
                {w.proofs.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {w.proofs.map((p) => (
                      <li key={p.id} className="flex items-start gap-2 rounded-xl border border-white/10 p-2 text-sm">
                        {p.kind === "link" ? <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                        <span className="min-w-0 flex-1">
                          <button type="button" onClick={() => openProof(p)} className="block max-w-full truncate text-left font-semibold text-cyan hover:underline">
                            {p.name}
                          </button>
                          <span className="block text-xs text-slate-500">
                            {t("Ajouté le {date} par {name}", { date: new Date(p.addedAt).toLocaleString(f.locale, DT), name: p.addedBy })}
                            {p.consultedAt && ` · ${t("source consultée le {date}", { date: new Date(p.consultedAt).toLocaleString(f.locale, DT) })}`}
                          </span>
                          {p.sha256 && (
                            <span className="flex items-center gap-1 break-all font-mono text-[10px] text-slate-500" title={t("Empreinte SHA-256 : prouve que le fichier n'a pas été modifié depuis son ajout")}>
                              <Fingerprint className="h-3 w-3 shrink-0" /> {p.sha256}
                            </span>
                          )}
                        </span>
                        <button type="button" onClick={() => set("proofs", w.proofs.filter((x) => x.id !== p.id))} className="rounded-lg p-2 text-slate-400 hover:bg-white/5" aria-label={t("Retirer")}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!w.proofs.length && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("Sans preuve, l'intempérie reste « à justifier ».")}
                  </p>
                )}
                {w.photoIds.length > 0 && <p className="mt-2 text-xs text-slate-400">{t("{n} photo(s) du chantier jointe(s) (horodatées).", { n: w.photoIds.length })}</p>}
              </div>

              <Field label={t("Commentaire")}>
                <textarea rows={2} value={w.comment} onChange={(e) => set("comment", e.target.value)} className={inputClass} />
              </Field>
            </>
          )}
        </fieldset>

        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

        {!isNew && (
          <details className="rounded-2xl border border-white/10 p-3 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-white">
              <History className="h-4 w-4" /> {t("Historique")} ({w.history.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {[...w.history].reverse().map((h, i) => (
                <li key={i}>
                  <span className="text-slate-300">{new Date(h.at).toLocaleString(f.locale, DT)}</span> — {h.user} — {t(h.action)}
                  {h.detail && ` : ${h.detail}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}
