"use client";

import { useMemo, useState } from "react";
import { Columns3, HardHat, List, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { VoiceQuoteButton } from "./VoiceQuoteChat";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { JOB_STATUS, JOB_STATUSES } from "@/lib/app/labels";
import { audit, jobFinance } from "@/lib/app/ops";
import type { Job, JobStatus } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, DataTable, Empty, PageHeader, SearchBox, Stat, inputClass } from "./ui";

export function JobsTab({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { t: land } = useI18n();
  const { data, update } = useAppData();
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [trade, setTrade] = useState("all");
  const [rep, setRep] = useState("all");
  const [sort, setSort] = useState({ key: "date", dir: "desc" as "asc" | "desc" });
  const [dragId, setDragId] = useState<string | null>(null);
  const client = (id: string) => data.clients.find((c) => c.id === id);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.jobs.filter(
      (j) => (status === "all" || j.status === status) && (trade === "all" || j.trade === trade) && (rep === "all" || j.salesRep === rep) && (!s || [j.name, client(j.clientId)?.name ?? "", j.siteAddress, client(j.clientId)?.billing.city ?? "", j.notes].some((x) => x.toLowerCase().includes(s))),
    );
  }, [data.jobs, data.clients, q, status, trade, rep]);

  const decided = data.jobs.filter((j) => ["accepted", "in_progress", "done", "refused", "lost"].includes(j.status));
  const won = decided.filter((j) => ["accepted", "in_progress", "done"].includes(j.status));
  const pending = data.jobs.filter((j) => j.status === "sent");
  const reps = [...new Set(data.jobs.map((j) => j.salesRep).filter(Boolean))];
  const setJobStatus = (j: Job, s: JobStatus) => update((d) => audit({ ...d, jobs: d.jobs.map((x) => (x.id === j.id ? { ...x, status: s } : x)) }, "status", "job", j.id, s));

  return (
    <div>
      <PageHeader
        title={t("Chantiers")}
        subtitle={t("{n} chantier(s)", { n: data.jobs.length })}
        actions={
          <>
            <div className="flex rounded-xl border border-white/10 p-1">
              <button onClick={() => setView("list")} className={cn("rounded-lg px-3 py-1.5 text-sm", view === "list" ? "bg-white/10 text-white" : "text-slate-400")} aria-label={t("Liste")}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setView("pipeline")} className={cn("rounded-lg px-3 py-1.5 text-sm", view === "pipeline" ? "bg-white/10 text-white" : "text-slate-400")} aria-label={t("Pipeline")}>
                <Columns3 className="h-4 w-4" />
              </button>
            </div>
            <button onClick={onAdd} className="btn-ghost !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Nouveau chantier")}
            </button>
            <VoiceQuoteButton />
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Taux de signature")} value={decided.length ? `${Math.round((won.length / decided.length) * 100)} %` : "—"} sub={t("{w} signés / {d} décidés", { w: won.length, d: decided.length })} />
        <Stat label={t("Devis en attente")} value={f.money0(pending.reduce((s, j) => s + j.amount, 0))} sub={t("pondéré : {p}", { p: f.money0(pending.reduce((s, j) => s + (j.amount * j.probability) / 100, 0)) })} />
        <Stat label={t("Restant à facturer")} value={f.money0(data.jobs.reduce((s, j) => s + jobFinance(data, j.id).toInvoice, 0))} />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher : chantier, client, localité…")} />
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Statut")}>
          <option value="all">{t("Tous les statuts")}</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(JOB_STATUS[s].label)}
            </option>
          ))}
        </select>
        <select className={inputClass} value={trade} onChange={(e) => setTrade(e.target.value)} aria-label={t("Métier")}>
          <option value="all">{t("Tous les métiers")}</option>
          {land.trades.list.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={rep} onChange={(e) => setRep(e.target.value)} aria-label={t("Commercial")}>
          <option value="all">{t("Tous les commerciaux")}</option>
          {reps.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      {!data.jobs.length ? (
        <Empty icon={HardHat} text={t("Créez votre premier chantier : dictez-le, Biltov prépare le devis avec vos prix.")} action={<button onClick={onAdd} className="btn-primary text-sm"><Plus className="h-4 w-4" /> {t("Nouveau chantier")}</button>} />
      ) : view === "list" ? (
        <DataTable
          rows={rows}
          onRow={(j) => onOpen(j.id)}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
          cols={[
            { key: "name", label: t("Chantier"), sort: (j) => j.name, render: (j) => <span className="font-semibold text-slate-100">{j.name}</span> },
            { key: "client", label: t("Client"), sort: (j) => client(j.clientId)?.name ?? "", render: (j) => <span className="text-slate-300">{client(j.clientId)?.name}</span> },
            { key: "city", label: t("Localité"), sort: (j) => client(j.clientId)?.billing.city ?? "", render: (j) => <span className="text-slate-400">{client(j.clientId)?.billing.city}</span> },
            { key: "amount", label: t("Montant HTVA"), sort: (j) => j.amount, render: (j) => <span className="font-semibold tabular-nums">{f.money0(j.amount)}</span>, className: "text-right" },
            { key: "margin", label: t("Marge"), sort: (j) => jobFinance(data, j.id).marginRate, render: (j) => <span className="tabular-nums text-emerald">{jobFinance(data, j.id).marginRate} %</span>, className: "text-right" },
            { key: "status", label: t("Statut"), sort: (j) => JOB_STATUSES.indexOf(j.status), render: (j) => <Badge label={t(JOB_STATUS[j.status].label)} style={JOB_STATUS[j.status].style} /> },
            { key: "date", label: t("Date"), sort: (j) => j.date, render: (j) => <span className="tabular-nums text-slate-400">{f.date(j.date)}</span> },
          ]}
          empty={t("Aucun chantier ne correspond.")}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {JOB_STATUSES.map((s) => {
            const col = rows.filter((j) => j.status === s);
            return (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const j = data.jobs.find((x) => x.id === dragId);
                  if (j) setJobStatus(j, s);
                  setDragId(null);
                }}
                className="w-64 shrink-0 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
              >
                <p className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-200">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: JOB_STATUS[s].color }} />
                    {t(JOB_STATUS[s].label)}
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">{f.money0(col.reduce((a, j) => a + j.amount, 0))}</span>
                </p>
                <div className="space-y-2">
                  {col.map((j) => (
                    <button key={j.id} draggable onDragStart={() => setDragId(j.id)} onClick={() => onOpen(j.id)} className="card w-full cursor-grab p-3 text-left text-sm active:cursor-grabbing">
                      <span className="block font-semibold text-slate-100">{j.name}</span>
                      <span className="block text-xs text-slate-500">{client(j.clientId)?.name}</span>
                      <span className="mt-1 flex justify-between text-xs">
                        <span className="tabular-nums text-slate-300">{f.money0(j.amount)}</span>
                        <span className="text-slate-500">{j.probability} %</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
