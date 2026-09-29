"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, FilePlus2, FileText, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { computeTotals, eur } from "@/lib/app/money";
import { fmtDate } from "@/lib/app/legal";
import { DOC_STATUS, JOB_STATUS, JOB_STATUSES } from "@/lib/app/labels";
import { docTitle } from "@/lib/app/pdf";
import type { Job } from "@/lib/app/types";
import { Badge } from "./Badge";
import { Empty, SubTabs, inputClass } from "./ui";
import { JobForm } from "./JobForm";
import { PhotosPanel } from "./PhotosPanel";
import { ExpensesPanel } from "./ExpensesPanel";

type Tab = "docs" | "photos" | "costs" | "info";

export function JobDetail({ job, onBack, onOpenDoc }: { job: Job; onBack: () => void; onOpenDoc: (id: string) => void }) {
  const { t } = useI18n();
  const { data, createQuote, saveJob, removeJob } = useAppData();
  const [tab, setTab] = useState<Tab>("docs");
  const [editing, setEditing] = useState(false);
  const docs = data.docs.filter((d) => d.jobId === job.id).sort((a, b) => (b.number ?? "~").localeCompare(a.number ?? "~"));
  const photos = data.photos.filter((p) => p.jobId === job.id).length;
  const costs = data.expenses.filter((e) => e.jobId === job.id).length;

  const remove = () => {
    if (!window.confirm(`Supprimer le chantier « ${job.name} » et ses brouillons, photos et dépenses ?`)) return;
    const res = removeJob(job.id);
    if (!res.ok) window.alert(res.reason);
    else onBack();
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Tous les chantiers
      </button>

      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{job.name}</h1>
            <label className="relative">
              <Badge {...JOB_STATUS[job.status]} />
              <select value={job.status} onChange={(e) => saveJob({ ...job, status: e.target.value as Job["status"] })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Statut">
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS[s].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-1 text-slate-300">
            {job.client} <span className="text-slate-500">· {job.clientType === "professionnel" ? "Professionnel" : "Particulier"} · {t.trades.list.find((x) => x.id === job.trade)?.name}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
            {(job.siteAddress || job.clientAddress) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {job.siteAddress || job.clientAddress}
              </span>
            )}
            {job.clientPhone && (
              <a href={`tel:${job.clientPhone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="h-3.5 w-3.5" /> {job.clientPhone}
              </a>
            )}
            {job.clientEmail && (
              <a href={`mailto:${job.clientEmail}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="h-3.5 w-3.5" /> {job.clientEmail}
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost !px-3 text-sm">
            <Pencil className="h-4 w-4" /> Modifier
          </button>
          <button onClick={remove} className="btn-ghost !px-3 text-sm text-rose-300" aria-label="Supprimer le chantier">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SubTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "docs", label: "Devis & factures", count: docs.length },
          { id: "photos", label: "Photos", count: photos },
          { id: "costs", label: "Dépenses & marge", count: costs },
          { id: "info", label: "Infos" },
        ]}
      />

      {tab === "docs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => onOpenDoc(createQuote(job.id).id)} className="btn-primary !py-2 text-sm">
              <FilePlus2 className="h-4 w-4" /> Nouveau devis
            </button>
          </div>
          {docs.length === 0 ? (
            <Empty icon={FileText} text="Aucun devis pour ce chantier. Créez-en un : vous pourrez le dicter." />
          ) : (
            <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
              {docs.map((d) => {
                const tt = computeTotals(d, data.company.vatMode === "normal" && !job.reverseCharge);
                return (
                  <li key={d.id}>
                    <button onClick={() => onOpenDoc(d.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03]">
                      <FileText className="h-5 w-5 shrink-0 text-cyan" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-100">
                          {docTitle(d).charAt(0) + docTitle(d).slice(1).toLowerCase()} {d.number ?? "(brouillon)"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(d.issueDate)} · {d.lines.length} ligne(s)
                          {d.type === "invoice" && d.lockedAt && d.status === "issued" ? ` · échéance ${fmtDate(d.dueDate)}` : ""}
                        </p>
                      </div>
                      <Badge {...DOC_STATUS[d.status]} className="hidden sm:inline-flex" />
                      <span className="w-28 text-right font-semibold tabular-nums text-white">{eur(tt.ttc)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {tab === "photos" && <PhotosPanel job={job} />}
      {tab === "costs" && <ExpensesPanel job={job} />}
      {tab === "info" && (
        <dl className="card grid gap-4 p-6 text-sm sm:grid-cols-2">
          {[
            ["Adresse du client", job.clientAddress],
            ["Adresse du chantier", job.siteAddress || "Identique"],
            ["SIREN du client", job.clientSiren],
            ["Début prévu", job.startDate ? fmtDate(job.startDate) : ""],
            ["Durée estimée", job.duration],
            ["Hors établissement", job.offPremises ? "Oui (rétractation 14 j)" : "Non"],
            ["TVA réduite possible", job.reducedVatEligible ? "Oui (logement > 2 ans)" : "Non"],
            ["Autoliquidation", job.reverseCharge ? "Oui" : "Non"],
            ["Notes", job.notes],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wider text-slate-500">{k}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-slate-200">{v || "—"}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <button onClick={() => setEditing(true)} className={`${inputClass} !w-auto cursor-pointer`}>
              Modifier ces informations
            </button>
          </div>
        </dl>
      )}

      <AnimatePresence>{editing && <JobForm job={job} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}</AnimatePresence>
    </div>
  );
}
