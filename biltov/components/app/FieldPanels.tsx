"use client";

// Panneaux « terrain » d'un chantier : heures, rapports / bons d'intervention, fichiers, discussion.

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ClipboardCheck, Clock, FileDown, FolderOpen, MessageSquare, Plus, Send, Trash2, Upload } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { nowIso, todayIso, uid } from "@/lib/app/defaults";
import { buildReportPdf } from "@/lib/app/pdf";
import { downloadBlob } from "@/lib/app/send";
import type { GenericRecord, Job, Report, TimeEntry } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Empty, Field, Modal, inputClass } from "./ui";
import { SignaturePad } from "./SignDialog";

export const hoursBetween = (start: string, end: string) => {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return Math.max(0, Math.round(((h2 * 60 + m2 - (h1 * 60 + m1)) / 60) * 100) / 100);
};

export function TimeForm({ entry, jobId, memberId, onClose }: { entry: TimeEntry | null; jobId?: string; memberId?: string; onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert } = useAppData();
  const [e, setE] = useState<TimeEntry>(entry ?? { id: uid(), memberId: memberId ?? data.members[0]?.id ?? "", jobId: jobId ?? data.jobs[0]?.id ?? "", date: todayIso(), start: "08:00", end: "16:00", hours: 8, note: "" });
  const set = <K extends keyof TimeEntry>(k: K, v: TimeEntry[K]) => setE((x) => ({ ...x, [k]: v, hours: k === "start" || k === "end" ? hoursBetween(k === "start" ? (v as string) : x.start, k === "end" ? (v as string) : x.end) : x.hours }));
  return (
    <Modal
      title={t("Heures prestées")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button
            disabled={!e.memberId || !e.jobId}
            onClick={() => {
              upsert("timeEntries", e);
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
        <Field label={t("Ouvrier")}>
          <select className={inputClass} value={e.memberId} onChange={(ev) => set("memberId", ev.target.value)}>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Chantier")}>
          <select className={inputClass} value={e.jobId} onChange={(ev) => set("jobId", ev.target.value)}>
            {data.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Date")}>
          <input type="date" className={inputClass} value={e.date} onChange={(ev) => set("date", ev.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={t("Début")}>
            <input type="time" className={inputClass} value={e.start} onChange={(ev) => set("start", ev.target.value)} />
          </Field>
          <Field label={t("Fin")}>
            <input type="time" className={inputClass} value={e.end} onChange={(ev) => set("end", ev.target.value)} />
          </Field>
          <Field label={t("Heures")}>
            <input type="number" step="0.25" className={inputClass} value={e.hours} onChange={(ev) => setE((x) => ({ ...x, hours: ev.target.valueAsNumber || 0 }))} />
          </Field>
        </div>
        <Field label={t("Tâche / note")} className="sm:col-span-2">
          <input className={inputClass} value={e.note} onChange={(ev) => set("note", ev.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function TimePanel({ job }: { job: Job }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, remove } = useAppData();
  const [form, setForm] = useState<TimeEntry | "new" | null>(null);
  const list = data.timeEntries.filter((x) => x.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  const member = (id: string) => data.members.find((m) => m.id === id);
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h4 className="font-display text-base font-bold text-white">{t("Heures prestées")} — {f.num(list.reduce((s, x) => s + x.hours, 0))} h</h4>
        <button onClick={() => setForm("new")} className="btn-primary !py-2 text-sm">
          <Plus className="h-4 w-4" /> {t("Pointer des heures")}
        </button>
      </div>
      {!list.length ? (
        <Empty icon={Clock} text={t("Aucune heure pointée. Les ouvriers pointent aussi depuis leur espace mobile.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {list.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: member(x.memberId)?.color }} />
              <button onClick={() => setForm(x)} className="min-w-0 flex-1 text-left">
                <span className="text-slate-100">{member(x.memberId)?.name}</span> <span className="text-slate-500">· {f.date(x.date)} · {x.start}–{x.end} · {x.note}</span>
              </button>
              <span className="tabular-nums text-white">{f.num(x.hours)} h</span>
              <span className="w-20 text-right tabular-nums text-slate-400">{f.money((member(x.memberId)?.hourlyCost ?? 0) * x.hours)}</span>
              <button onClick={() => remove("timeEntries", x.id)} className="p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>{form && <TimeForm entry={form === "new" ? null : form} jobId={job.id} onClose={() => setForm(null)} />}</AnimatePresence>
    </div>
  );
}

const CHECKLIST: Record<Report["kind"], string[]> = {
  intervention: ["Diagnostic réalisé", "Pièces remplacées", "Essais / mise en service", "Zone nettoyée", "Client informé"],
  daily: ["Travaux du jour réalisés", "Sécurité du chantier vérifiée", "Déchets évacués"],
  reception: ["Travaux conformes au devis", "Essais réalisés", "Remise des notices", "Réserves notées"],
  maintenance: ["Contrôle de combustion", "Nettoyage", "Réglages", "Étiquette d'entretien apposée"],
};

export function ReportForm({ report, job, onClose }: { report: Report | null; job: Job; onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert, getBlob, isDemo } = useAppData();
  const [r, setR] = useState<Report>(report ?? { id: uid(), jobId: job.id, kind: "intervention", date: todayIso(), memberIds: job.memberIds, checklist: CHECKLIST.intervention.map((label) => ({ label: t(label), done: false })), notes: "", photoIds: [], hours: 0, materials: [], signature: null, sentAt: null });
  const [sigName, setSigName] = useState(data.clients.find((c) => c.id === job.clientId)?.name ?? "");
  const [sig, setSig] = useState<string | null>(null);
  const set = <K extends keyof Report>(k: K, v: Report[K]) => setR((x) => ({ ...x, [k]: v }));
  const photos = data.photos.filter((p) => p.jobId === job.id);

  const saveAndPdf = async (download: boolean) => {
    const saved = { ...r, signature: sig ? { image: sig, name: sigName, at: nowIso() } : r.signature };
    upsert("reports", saved);
    if (download) {
      const pdf = await buildReportPdf(saved, job, data.clients.find((c) => c.id === job.clientId), data.photos, data, (id) => getBlob(`photo:${id}`), isDemo ? "DÉMONSTRATION" : undefined);
      downloadBlob(pdf.output("blob"), `rapport-${job.name}-${saved.date}.pdf`.replace(/[^\w.-]+/g, "-"));
    }
    onClose();
  };

  return (
    <Modal
      title={t("Rapport / bon d'intervention")}
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button onClick={() => saveAndPdf(false)} className="btn-ghost text-sm">
            {t("Enregistrer")}
          </button>
          <button onClick={() => saveAndPdf(true)} className="btn-primary text-sm">
            <FileDown className="h-4 w-4" /> {t("Enregistrer et PDF")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Type")}>
            <select className={inputClass} value={r.kind} onChange={(e) => setR((x) => ({ ...x, kind: e.target.value as Report["kind"], checklist: CHECKLIST[e.target.value as Report["kind"]].map((label) => ({ label: t(label), done: false })) }))}>
              <option value="intervention">{t("Bon d'intervention / dépannage")}</option>
              <option value="daily">{t("Rapport journalier")}</option>
              <option value="reception">{t("PV de réception")}</option>
              <option value="maintenance">{t("Entretien")}</option>
            </select>
          </Field>
          <Field label={t("Date")}>
            <input type="date" className={inputClass} value={r.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label={t("Heures")}>
            <input type="number" step="0.25" className={inputClass} value={r.hours} onChange={(e) => set("hours", e.target.valueAsNumber || 0)} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Check-list")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {r.checklist.map((c, i) => (
              <label key={i} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">
                <input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={c.done} onChange={(e) => set("checklist", r.checklist.map((x, k) => (k === i ? { ...x, done: e.target.checked } : x)))} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <Field label={t("Observations")}>
          <textarea className={cn(inputClass, "resize-y")} rows={3} value={r.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        {photos.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Photos jointes")}</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <label key={p.id} className={cn("rounded-lg border px-2 py-1 text-xs", r.photoIds.includes(p.id) ? "border-cyan text-cyan" : "border-white/10 text-slate-400")}>
                  <input type="checkbox" className="mr-1 accent-emerald-500" checked={r.photoIds.includes(p.id)} onChange={(e) => set("photoIds", e.target.checked ? [...r.photoIds, p.id] : r.photoIds.filter((x) => x !== p.id))} />
                  {t(p.phase)} · {p.caption || new Date(p.takenAt).toLocaleDateString()}
                </label>
              ))}
            </div>
          </div>
        )}
        {r.signature ? (
          <p className="text-sm text-emerald">{t("Signé par {n}", { n: r.signature.name })}</p>
        ) : (
          <div className="space-y-2">
            <Field label={t("Nom du client (signature sur place)")}>
              <input className={inputClass} value={sigName} onChange={(e) => setSigName(e.target.value)} />
            </Field>
            <SignaturePad onChange={setSig} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ReportsPanel({ job }: { job: Job }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [form, setForm] = useState<Report | "new" | null>(null);
  const list = data.reports.filter((r) => r.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h4 className="font-display text-base font-bold text-white">{t("Rapports et bons d'intervention")}</h4>
        <button onClick={() => setForm("new")} className="btn-primary !py-2 text-sm">
          <Plus className="h-4 w-4" /> {t("Nouveau rapport")}
        </button>
      </div>
      {!list.length ? (
        <Empty icon={ClipboardCheck} text={t("Check-list, photos et signature du client sur place, PDF prêt à envoyer.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {list.map((r) => (
            <li key={r.id}>
              <button onClick={() => setForm(r)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03]">
                <span className="text-slate-100">
                  {f.date(r.date)} — {t({ intervention: "Bon d'intervention", daily: "Rapport journalier", reception: "PV de réception", maintenance: "Entretien" }[r.kind])}
                </span>
                <span className="text-xs text-slate-400">
                  {r.checklist.filter((c) => c.done).length}/{r.checklist.length} · {r.signature ? t("signé") : t("non signé")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>{form && <ReportForm report={form === "new" ? null : form} job={job} onClose={() => setForm(null)} />}</AnimatePresence>
    </div>
  );
}

/** Coffre-fort documentaire (plans, permis, PV, attestations) par chantier ou client. */
export function FilesPanel({ jobId, clientId }: { jobId: string | null; clientId: string | null }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, remove, putBlob, getBlob } = useAppData();
  const [cat, setCat] = useState("Plans");
  const files = data.records.filter((r) => r.module === "documents" && (jobId ? r.jobId === jobId : r.clientId === clientId));
  const add = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      const id = uid();
      await putBlob(`file:${id}`, file);
      const rec: GenericRecord = { id, module: "documents", title: file.name, status: "stored", fields: { category: cat, size: file.size, type: file.type }, jobId, clientId, memberId: null, createdAt: nowIso(), updatedAt: nowIso() };
      upsert("records", rec);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-base font-bold text-white">{t("Documents")}</h4>
        <div className="flex gap-2">
          <select className={cn(inputClass, "!w-auto !py-2")} value={cat} onChange={(e) => setCat(e.target.value)}>
            {["Plans", "Permis", "PV de réception", "Attestations", "Fiches techniques", "Contrats", "Autres"].map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
          <label className="btn-primary cursor-pointer !py-2 text-sm">
            <Upload className="h-4 w-4" /> {t("Ajouter")}
            <input type="file" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
          </label>
        </div>
      </div>
      {!files.length ? (
        <Empty icon={FolderOpen} text={t("Plans, permis, PV de réception, attestations : tout le dossier au même endroit.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {files.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                onClick={async () => {
                  const b = await getBlob(`file:${r.id}`);
                  if (b) downloadBlob(b, r.title);
                }}
                className="min-w-0 flex-1 truncate text-left text-slate-100 hover:text-cyan"
              >
                {r.title}
              </button>
              <span className="text-xs text-slate-500">{t(String(r.fields.category))}</span>
              <span className="text-xs tabular-nums text-slate-500">{f.date(r.createdAt)}</span>
              <button onClick={() => remove("records", r.id)} className="p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Messagerie interne du chantier (bureau ↔ équipes). */
export function ChatPanel({ jobId }: { jobId: string }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, account } = useAppData();
  const [text, setText] = useState("");
  const [as, setAs] = useState(data.members.find((m) => m.role === "owner")?.id ?? "");
  const msgs = data.records.filter((r) => r.module === "chat" && r.jobId === jobId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const send = () => {
    if (!text.trim()) return;
    const m = data.members.find((x) => x.id === as);
    upsert("records", { id: uid(), module: "chat", title: m?.name ?? account?.email ?? "", status: "message", fields: { text: text.trim() }, jobId, clientId: null, memberId: as || null, createdAt: nowIso(), updatedAt: nowIso() });
    setText("");
  };
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 font-display text-base font-bold text-white">
        <MessageSquare className="h-4 w-4 text-cyan" /> {t("Discussion du chantier")}
      </h4>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-white/10 p-3">
        {msgs.map((m) => (
          <div key={m.id} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
            <p className="text-xs text-slate-500">
              {m.title} · {new Date(m.createdAt).toLocaleString(f.locale)}
            </p>
            <p className="whitespace-pre-line text-slate-200">{String(m.fields.text)}</p>
          </div>
        ))}
        {!msgs.length && <p className="text-sm text-slate-500">{t("Aucun message.")}</p>}
      </div>
      <div className="flex gap-2">
        <select className={cn(inputClass, "!w-40")} value={as} onChange={(e) => setAs(e.target.value)} aria-label={t("Auteur")}>
          <option value="">{t("Moi")}</option>
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={t("Message à l'équipe…")} />
        <button onClick={send} className="btn-primary !px-3" aria-label={t("Envoyer")}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
