"use client";

// Espace ouvrier : téléphone de chantier, sans aucun prix. Planning du jour, pointage, photos, rapports, tickets, discussion.

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, CalendarDays, CalendarPlus, Camera, ClipboardCheck, LogOut, MapPin, MessageSquare, Navigation, Phone, Play, Receipt, Square } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, todayIso, uid } from "@/lib/app/defaults";
import { onDay } from "@/lib/app/planning";
import type { Geo, Job, Member } from "@/lib/app/types";
import { currentGeo, mapsRoute, wazeRoute } from "@/lib/app/geo";
import { toIcs } from "@/lib/app/planning";
import { downloadBlob } from "@/lib/app/send";
import { cn } from "@/lib/utils";
import { Field, Modal, Notice, inputClass } from "./ui";
import { hoursBetween, ChatPanel, ReportsPanel } from "./FieldPanels";
import { ExpenseForm } from "./ExpensesPanel";
import { PhotosPanel } from "./PhotosPanel";

const CLOCK = "biltov.clock";
type Clock = { memberId: string; jobId: string; date: string; start: string; geo?: Geo | null };
const readClock = (): Clock | null => {
  try {
    return JSON.parse(localStorage.getItem(CLOCK) ?? "null");
  } catch {
    return null;
  }
};
const hhmm = () => new Date().toTimeString().slice(0, 5);

/** Choix du membre + code PIN. */
export function WorkerLogin({ onEnter, onCancel }: { onEnter: (m: Member) => void; onCancel: () => void }) {
  const { t } = useTr();
  const { data } = useAppData();
  const [who, setWho] = useState<Member | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const members = data.members.filter((m) => m.active);
  return (
    <Modal title={t("Espace ouvrier")} onClose={onCancel}>
      {!who ? (
        <div className="grid gap-2">
          {members.map((m) => (
            <button key={m.id} onClick={() => (m.pin ? setWho(m) : onEnter(m))} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-left hover:border-cyan/50">
              <span className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-white theme-fixed" style={{ background: m.color }}>
                {m.name.slice(0, 1)}
              </span>
              <span className="font-semibold text-white">{m.name}</span>
            </button>
          ))}
          {!members.length && <Notice>{t("Ajoutez d'abord votre équipe dans l'onglet Équipe.")}</Notice>}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === who.pin) onEnter(who);
            else setErr(true);
          }}
          className="space-y-4"
        >
          <Field label={t("Code PIN de {n}", { n: who.name })} error={err && t("Code incorrect.")}>
            <input autoFocus inputMode="numeric" type="password" className={cn(inputClass, "text-center text-2xl tracking-[0.5em]")} value={pin} onChange={(e) => (setPin(e.target.value.replace(/\D/g, "").slice(0, 6)), setErr(false))} />
          </Field>
          <button className="btn-primary w-full">{t("Entrer")}</button>
        </form>
      )}
    </Modal>
  );
}

export function WorkerMode({ member, onExit }: { member: Member; onExit: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const [jobId, setJobId] = useState<string | null>(null);
  const [clock, setClock] = useState<Clock | null>(null);
  const [expense, setExpense] = useState(false);
  const [leave, setLeave] = useState(false);
  const today = todayIso();
  useEffect(() => setClock(readClock()), []);

  const mine = data.events.filter((e) => e.memberIds.includes(member.id) && e.status !== "cancelled");
  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => ({ day: d, events: mine.filter((e) => onDay(e, d)) }));
  const jobIds = new Set([...mine.map((e) => e.jobId), ...data.jobs.filter((j) => j.memberIds.includes(member.id)).map((j) => j.id)].filter(Boolean) as string[]);
  const jobs = data.jobs.filter((j) => jobIds.has(j.id) && !["done", "refused", "lost"].includes(j.status));
  const job = data.jobs.find((j) => j.id === jobId);
  const myHours = data.timeEntries.filter((e) => e.memberId === member.id && e.date >= addDays(today, -6)).reduce((s, e) => s + e.hours, 0);

  const start = async (j: Job) => {
    const c: Clock = { memberId: member.id, jobId: j.id, date: today, start: hhmm(), geo: await currentGeo() };
    localStorage.setItem(CLOCK, JSON.stringify(c));
    setClock(c);
  };
  const stop = async () => {
    if (!clock) return;
    const end = hhmm();
    const geoEnd = await currentGeo();
    upsert("timeEntries", { id: uid(), memberId: clock.memberId, jobId: clock.jobId, date: clock.date, start: clock.start, end, hours: hoursBetween(clock.start, end), note: t("Pointage mobile"), geoStart: clock.geo ?? null, geoEnd });
    localStorage.removeItem(CLOCK);
    setClock(null);
  };
  const running = clock?.memberId === member.id ? clock : null;

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">{t("Espace ouvrier")}</p>
          <h1 className="font-display text-2xl font-bold text-white">{member.name}</h1>
        </div>
        <button onClick={onExit} className="btn-ghost !py-2 text-sm">
          <LogOut className="h-4 w-4" /> {t("Quitter")}
        </button>
      </div>

      {running && (
        <div className="card flex items-center justify-between gap-3 border-emerald/40 p-4">
          <p className="text-sm text-emerald">
            {t("Pointage en cours depuis {h}", { h: running.start })} — {data.jobs.find((j) => j.id === running.jobId)?.name}
          </p>
          <button onClick={stop} className="btn-primary !py-2 text-sm">
            <Square className="h-4 w-4" /> {t("Arrêter")}
          </button>
        </div>
      )}

      {!job ? (
        <>
          <div className="card p-4">
            <p className="mb-3 text-sm font-semibold text-white">{t("Mon planning")}</p>
            <ul className="space-y-2 text-sm">
              {upcoming.map(({ day, events }) => (
                <li key={day} className="flex gap-3">
                  <span className={cn("w-20 shrink-0 text-xs", day === today ? "font-bold text-cyan" : "text-slate-500")}>{new Date(`${day}T12:00`).toLocaleDateString(f.locale, { weekday: "short", day: "numeric" })}</span>
                  <span className="flex-1 space-y-1">
                    {events.length ? (
                      events.map((e) => (
                        <button key={e.id} onClick={() => e.jobId && setJobId(e.jobId)} className="block text-left text-slate-200 hover:text-cyan">
                          {e.title} <span className="text-xs text-slate-500">{e.start.slice(11)}–{e.end.slice(11)}</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">{t("Mes chantiers")}</p>
            {jobs.map((j) => (
              <button key={j.id} onClick={() => setJobId(j.id)} className="card block w-full p-4 text-left">
                <span className="block font-semibold text-white">{j.name}</span>
                <span className="block text-xs text-slate-500">{j.siteAddress || data.clients.find((c) => c.id === j.clientId)?.billing.city}</span>
              </button>
            ))}
            {!jobs.length && <p className="text-sm text-slate-500">{t("Aucun chantier ne vous est attribué.")}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setExpense(true)} className="card flex flex-col items-center gap-2 p-4 text-sm text-slate-200">
              <Receipt className="h-5 w-5 text-cyan" /> {t("Ticket / note de frais")}
            </button>
            <button onClick={() => setLeave(true)} className="card flex flex-col items-center gap-2 p-4 text-sm text-slate-200">
              <CalendarPlus className="h-5 w-5 text-cyan" /> {t("Demander un congé")}
            </button>
          </div>
          <button onClick={() => downloadBlob(new Blob([toIcs(mine.filter((e) => e.end.slice(0, 10) >= today), data)], { type: "text/calendar" }), `planning-${member.name}.ics`)} className="btn-ghost w-full !py-2 text-sm">
            <CalendarDays className="h-4 w-4" /> {t("Ajouter mon planning à mon agenda (.ics)")}
          </button>
          <p className="text-center text-xs text-slate-500">{t("{h} h pointées ces 7 derniers jours", { h: f.num(myHours, 1) })}</p>
        </>
      ) : (
        <WorkerJob job={job} member={member} running={!!running} onStart={() => start(job)} onBack={() => setJobId(null)} />
      )}

      <AnimatePresence>
        {expense && <ExpenseForm jobId={jobId} expense={null} workerId={member.id} onClose={() => setExpense(false)} />}
        {leave && <LeaveRequest member={member} onClose={() => setLeave(false)} />}
      </AnimatePresence>
    </div>
  );
}

function WorkerJob({ job, member, running, onStart, onBack }: { job: Job; member: Member; running: boolean; onStart: () => void; onBack: () => void }) {
  const { t } = useTr();
  const { data } = useAppData();
  const [panel, setPanel] = useState<"photos" | "reports" | "chat">("photos");
  const client = data.clients.find((c) => c.id === job.clientId);
  const missions = data.events.filter((e) => e.jobId === job.id && e.memberIds.includes(member.id) && e.end.slice(0, 10) >= todayIso() && e.status !== "cancelled").slice(0, 5);
  const address = job.siteAddress || [client?.billing.street, client?.billing.postcode, client?.billing.city].filter(Boolean).join(", ");
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400">
        <ArrowLeft className="h-4 w-4" /> {t("Retour")}
      </button>
      <div className="card space-y-3 p-4">
        <h2 className="font-display text-xl font-bold text-white">{job.name}</h2>
        {address && (
          <>
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4 text-cyan" /> {address}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href={mapsRoute(address)} target="_blank" rel="noreferrer" className="btn-ghost !py-2 text-sm">
                <Navigation className="h-4 w-4" /> Google Maps
              </a>
              <a href={wazeRoute(address)} target="_blank" rel="noreferrer" className="btn-ghost !py-2 text-sm">
                <Navigation className="h-4 w-4" /> Waze
              </a>
            </div>
          </>
        )}
        {missions.length > 0 && (
          <div className="rounded-xl border border-white/10 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Ordre de mission")}</p>
            {missions.map((e) => (
              <p key={e.id} className="text-slate-300">
                {new Date(e.start).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} {e.start.slice(11)}–{e.end.slice(11)} · {e.title}
                {e.notes && <span className="block whitespace-pre-line text-xs text-slate-500">{e.notes}</span>}
              </p>
            ))}
          </div>
        )}
        {client?.phone && (
          <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-slate-300">
            <Phone className="h-4 w-4" /> {client.name} — {client.phone}
          </a>
        )}
        {job.notes && <p className="whitespace-pre-line text-sm text-slate-400">{job.notes}</p>}
        {!running && (
          <button onClick={onStart} className="btn-primary w-full">
            <Play className="h-4 w-4" /> {t("Commencer le pointage")}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["photos", Camera, t("Photos")],
            ["reports", ClipboardCheck, t("Rapports")],
            ["chat", MessageSquare, t("Discussion")],
          ] as const
        ).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setPanel(id)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold", panel === id ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-400")}>
            <Icon className="h-5 w-5" /> {label}
          </button>
        ))}
      </div>
      {panel === "photos" && <PhotosPanel job={job} />}
      {panel === "reports" && <ReportsPanel job={job} />}
      {panel === "chat" && <ChatPanel jobId={job.id} authorId={member.id} />}
    </div>
  );
}

function LeaveRequest({ member, onClose }: { member: Member; onClose: () => void }) {
  const { t } = useTr();
  const { upsert } = useAppData();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [note, setNote] = useState("");
  return (
    <Modal
      title={t("Demande de congé")}
      onClose={onClose}
      footer={
        <button
          disabled={to < from}
          onClick={() => {
            upsert("events", { id: uid(), kind: "leave", title: t("Congé {n}", { n: member.name }), jobId: null, clientId: null, memberIds: [member.id], start: `${from}T00:00`, end: `${to}T23:59`, notes: note, status: "requested" });
            onClose();
          }}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {t("Envoyer la demande")}
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Du")}>
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("Au")}>
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label={t("Motif (facultatif)")} className="sm:col-span-2">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
