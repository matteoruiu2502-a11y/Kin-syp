"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, CloudSun, FilePlus2, FileText, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { computeTotals } from "@/lib/app/money";
import { audit, createQuote, jobFinance } from "@/lib/app/ops";
import { CLIENT_KIND, DOC_STATUS, JOB_STATUS, JOB_STATUSES } from "@/lib/app/labels";
import { docTitle } from "@/lib/app/pdf";
import type { Job } from "@/lib/app/types";
import { Badge, Empty, Stat, SubTabs } from "./ui";
import { JobForm } from "./JobForm";
import { PhotosPanel } from "./PhotosPanel";
import { JobProfitPanel } from "./JobProfitPanel";
import { mapsEmbed, mapsRoute, wazeRoute } from "@/lib/app/geo";
import { ExpensesList } from "./ExpensesPanel";
import { ChatPanel, FilesPanel, ReportsPanel, TimePanel } from "./FieldPanels";

type Tab = "docs" | "finance" | "time" | "reports" | "photos" | "costs" | "files" | "chat";

export function JobDetail({ job, onBack, onOpenDoc, onOpenClient, initialTab = "docs" }: { job: Job; onBack: () => void; onOpenDoc: (id: string) => void; onOpenClient: (id: string) => void; initialTab?: "docs" | "finance" }) {
  const { t } = useTr();
  const f = useFmt();
  const { t: land } = useI18n();
  const { data, update, run } = useAppData();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const client = data.clients.find((c) => c.id === job.clientId);
  const docs = data.docs.filter((d) => d.jobId === job.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate) || (b.number ?? "~").localeCompare(a.number ?? "~"));
  const fin = jobFinance(data, job.id);
  const site = client?.sites.find((s) => s.id === job.siteId);
  const address = site ? `${site.street}, ${site.postcode} ${site.city}` : job.siteAddress || (client ? `${client.billing.street}, ${client.billing.postcode} ${client.billing.city}` : "");
  const m = data.settings.modules;

  const remove = () => {
    if (docs.some((d) => d.lockedAt)) return window.alert(t("Ce chantier contient des documents émis : ils doivent être conservés. Archivez-le plutôt (statut « Terminé »)."));
    if (!window.confirm(t("Supprimer le chantier « {n} » et ses brouillons ?", { n: job.name }))) return;
    update((d) => audit({ ...d, jobs: d.jobs.filter((j) => j.id !== job.id), docs: d.docs.filter((x) => x.jobId !== job.id), photos: d.photos.filter((p) => p.jobId !== job.id), timeEntries: d.timeEntries.filter((x) => x.jobId !== job.id), reports: d.reports.filter((r) => r.jobId !== job.id) }, "delete", "job", job.id, job.name));
    onBack();
  };

  const tabs: { id: Tab; label: string; count?: number; on?: boolean }[] = [
    { id: "docs", label: t("Devis & factures"), count: docs.length },
    { id: "finance", label: t("Rentabilité") },
    { id: "time", label: t("Heures"), count: data.timeEntries.filter((x) => x.jobId === job.id).length, on: m.time },
    { id: "reports", label: t("Rapports"), count: data.reports.filter((r) => r.jobId === job.id).length, on: m.reports },
    { id: "photos", label: t("Photos"), count: data.photos.filter((p) => p.jobId === job.id).length },
    { id: "costs", label: t("Dépenses"), count: data.expenses.filter((e) => e.jobId === job.id).length },
    { id: "files", label: t("Documents"), on: m.documents },
    { id: "chat", label: t("Discussion"), count: data.records.filter((r) => r.module === "chat" && r.jobId === job.id).length, on: m.chat },
  ];

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {t("Tous les chantiers")}
      </button>
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{job.name}</h1>
            <label className="relative">
              <Badge label={t(JOB_STATUS[job.status].label)} style={JOB_STATUS[job.status].style} />
              <select value={job.status} onChange={(e) => update((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === job.id ? { ...j, status: e.target.value as Job["status"] } : j)) }))} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t("Statut")}>
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(JOB_STATUS[s].label)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {client && (
            <button onClick={() => onOpenClient(client.id)} className="mt-1 text-left text-slate-300 hover:text-cyan">
              {client.name} <span className="text-slate-500">· {t(CLIENT_KIND[client.kind]).split(" (")[0]} · {land.trades.list.find((x) => x.id === job.trade)?.name}</span>
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
            {address && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button onClick={() => setShowMap((v) => !v)} className="flex items-center gap-1.5 hover:text-white">
                  <MapPin className="h-3.5 w-3.5" /> {address}
                </button>
                <a href={mapsRoute(address)} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
                  Maps
                </a>
                <a href={wazeRoute(address)} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
                  Waze
                </a>
              </span>
            )}
            {client?.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="h-3.5 w-3.5" /> {client.phone}
              </a>
            )}
            {client?.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="h-3.5 w-3.5" /> {client.email}
              </a>
            )}
            {job.weatherSensitive && (
              <span className="flex items-center gap-1.5 text-amber-300">
                <CloudSun className="h-3.5 w-3.5" /> {t("Travaux extérieurs")}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t("TVA")} : {job.workKind === "immobilier" ? t("travaux immobiliers") : t("livraison")} · {job.privateHousing ? t("logement privé") : t("non résidentiel")} · {t("1re occupation")} {job.firstOccupationYear ?? "?"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost !px-3 text-sm">
            <Pencil className="h-4 w-4" /> {t("Modifier")}
          </button>
          <button onClick={remove} className="btn-ghost !px-3 text-sm text-rose-300" aria-label={t("Supprimer")}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showMap && address && (
        <iframe title={t("Carte du chantier")} src={mapsEmbed(address)} className="h-72 w-full rounded-2xl border border-white/10" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t("Devis signé (HTVA)")} value={f.money0(fin.quoted)} />
        <Stat label={t("Facturé (HTVA)")} value={f.money0(fin.invoiced)} />
        <Stat label={t("Reste à facturer")} value={f.money0(fin.toInvoice)} tone={fin.toInvoice > 0 ? "warn" : undefined} />
        <Stat label={t("Reste à encaisser")} value={f.money0(fin.toCash)} tone={fin.toCash > 0 ? "warn" : undefined} />
        <Stat label={t("Marge réelle")} value={`${f.money0(fin.margin)}`} sub={`${fin.marginRate} %`} tone={fin.margin >= 0 ? "ok" : "danger"} />
      </div>

      <SubTabs<Tab> value={tab} onChange={setTab} tabs={tabs.filter((x) => x.on !== false)} />

      {tab === "docs" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => onOpenDoc(run((d) => createQuote(d, job.id)).id)} className="btn-primary !py-2 text-sm">
              <FilePlus2 className="h-4 w-4" /> {t("Nouveau devis")}
            </button>
          </div>
          {!docs.length ? (
            <Empty icon={FileText} text={t("Aucun devis pour ce chantier. Créez-en un : vous pourrez le dicter.")} />
          ) : (
            <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
              {docs.map((d) => (
                <li key={d.id}>
                  <button onClick={() => onOpenDoc(d.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03]">
                    <FileText className="h-5 w-5 shrink-0 text-cyan" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-100">
                        {docTitle(d, "fr").charAt(0) + docTitle(d, "fr").slice(1).toLowerCase()} {d.number ?? t("(brouillon)")} {d.isAmendment && <span className="text-xs text-violet-300">({t("avenant")})</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {f.date(d.issueDate)} · {d.lines.filter((l) => l.kind === "item").length} {t("ligne(s)")} · {d.lang.toUpperCase()}
                      </p>
                    </div>
                    <Badge label={t(DOC_STATUS[d.status].label)} style={DOC_STATUS[d.status].style} className="hidden sm:inline-flex" />
                    <span className="w-28 text-right font-semibold tabular-nums text-white">{f.money(computeTotals(d).tvac)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tab === "finance" && <JobProfitPanel job={job} />}
      {tab === "time" && <TimePanel job={job} />}
      {tab === "reports" && <ReportsPanel job={job} />}
      {tab === "photos" && <PhotosPanel job={job} />}
      {tab === "costs" && <ExpensesList jobId={job.id} />}
      {tab === "files" && <FilesPanel jobId={job.id} clientId={job.clientId} />}
      {tab === "chat" && <ChatPanel jobId={job.id} />}

      <AnimatePresence>{editing && <JobForm job={job} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}</AnimatePresence>
    </div>
  );
}
