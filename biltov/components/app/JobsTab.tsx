"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, HardHat, Plus, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { JOB_STATUS, JOB_STATUSES } from "@/lib/app/labels";
import { fmtDate } from "@/lib/app/legal";
import { downloadBlob } from "@/lib/app/send";
import { todayIso } from "@/lib/app/defaults";
import type { Job, JobStatus } from "@/lib/app/types";
import type { TradeId } from "@/lib/content/fr";
import { cn, formatMoney } from "@/lib/utils";
import { Badge } from "./Badge";
import { Empty, inputClass } from "./ui";

type SortKey = "name" | "client" | "city" | "trade" | "amount" | "status" | "date";

export function JobsTab({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { t } = useI18n();
  const { data, saveJob } = useAppData();
  const tradeName = (id: TradeId) => t.trades.list.find((x) => x.id === id)?.name ?? id;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [trade, setTrade] = useState<TradeId | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
    const list = data.jobs.filter(
      (j) => (status === "all" || j.status === status) && (trade === "all" || j.trade === trade) && (!q || [j.name, j.client, j.city, j.siteAddress, j.notes].some((f) => f.toLowerCase().includes(q))),
    );
    const cmp = (a: Job, b: Job) =>
      sortKey === "amount"
        ? a.amount - b.amount
        : sortKey === "date"
          ? a.date.localeCompare(b.date)
          : sortKey === "status"
            ? JOB_STATUSES.indexOf(a.status) - JOB_STATUSES.indexOf(b.status)
            : sortKey === "trade"
              ? col.compare(tradeName(a.trade), tradeName(b.trade))
              : col.compare(a[sortKey], b[sortKey]);
    return list.sort((a, b) => (dir === "asc" ? cmp(a, b) : -cmp(a, b)) || col.compare(a.name, b.name));
  }, [data.jobs, query, status, trade, sortKey, dir, t]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDir((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "amount" || key === "date" ? "desc" : "asc");
    }
  };

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Chantier", "Client", "Type", "Ville", "Métier", "Montant HT", "Statut", "Date", "Adresse chantier", "Téléphone", "E-mail"];
    const rows = visible.map((j) => [j.name, j.client, j.clientType, j.city, tradeName(j.trade), j.amount.toFixed(2).replace(".", ","), JOB_STATUS[j.status].label, j.date, j.siteAddress || j.clientAddress, j.clientPhone, j.clientEmail].map(esc).join(";"));
    downloadBlob(new Blob(["﻿" + [head.map(esc).join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }), `biltov-chantiers-${todayIso()}.csv`);
  };

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "name", label: "Chantier" },
    { key: "client", label: "Client" },
    { key: "city", label: "Ville", className: "hidden xl:table-cell" },
    { key: "trade", label: "Métier", className: "hidden xl:table-cell" },
    { key: "amount", label: "Montant HT", className: "text-right" },
    { key: "status", label: "Statut" },
    { key: "date", label: "Date" },
  ];

  const StatusPick = ({ job }: { job: Job }) => (
    <label className="relative inline-flex">
      <Badge {...JOB_STATUS[job.status]} className="pointer-events-none" />
      <select value={job.status} onChange={(e) => saveJob({ ...job, status: e.target.value as JobStatus })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Statut">
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {JOB_STATUS[s].label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Chantiers &amp; devis</h1>
          <p className="mt-1 text-sm text-slate-400">{visible.length} chantier(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={!visible.length} className="btn-ghost !px-4 !py-2.5 text-sm disabled:opacity-40" title="Exporter en CSV (Excel)">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exporter</span>
          </button>
          <button onClick={onAdd} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> Nouveau chantier
          </button>
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher : chantier, client, ville…" className={cn(inputClass, "pl-9")} type="search" aria-label="Rechercher" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus | "all")} className={inputClass} aria-label="Statut">
          <option value="all">Tous les statuts</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS[s].label}
            </option>
          ))}
        </select>
        <select value={trade} onChange={(e) => setTrade(e.target.value as TradeId | "all")} className={inputClass} aria-label="Métier">
          <option value="all">Tous les métiers</option>
          {t.trades.list.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={cn(inputClass, "min-w-0 flex-1")} aria-label="Trier par">
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                Trier par : {c.label}
              </option>
            ))}
          </select>
          <button onClick={() => setDir((x) => (x === "asc" ? "desc" : "asc"))} className={cn(inputClass, "!w-11 shrink-0 !px-0 flex items-center justify-center")} aria-label={dir === "asc" ? "Croissant" : "Décroissant"}>
            {dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          icon={HardHat}
          text={data.jobs.length ? "Aucun chantier ne correspond à votre recherche." : "Créez votre premier chantier : dictez-le, Biltov prépare le devis."}
          action={
            <button onClick={onAdd} className="btn-primary text-sm">
              <Plus className="h-4 w-4" /> Nouveau chantier
            </button>
          }
        />
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                  {columns.map((c) => (
                    <th key={c.key} className={cn("px-4 py-3 font-semibold", c.className)} aria-sort={sortKey === c.key ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                      <button onClick={() => sortBy(c.key)} className={cn("inline-flex items-center gap-1 hover:text-white", sortKey === c.key && "text-cyan")}>
                        {c.label}
                        {sortKey === c.key ? dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((j) => (
                  <tr key={j.id} className="cursor-pointer border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]" onClick={() => onOpen(j.id)}>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-100">{j.name}</span>
                      {j.siteAddress && <p className="max-w-xs truncate text-xs text-slate-500">{j.siteAddress}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{j.client}</td>
                    <td className="hidden px-4 py-3 text-slate-400 xl:table-cell">{j.city}</td>
                    <td className="hidden px-4 py-3 text-slate-400 xl:table-cell">{tradeName(j.trade)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">{formatMoney(j.amount, "fr-FR", 0)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusPick job={j} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{fmtDate(j.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {visible.map((j) => (
              <li key={j.id} className="card p-4">
                <button onClick={() => onOpen(j.id)} className="flex w-full items-start justify-between gap-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-100">{j.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {j.client} · {j.city || tradeName(j.trade)}
                    </span>
                  </span>
                  <span className="shrink-0 font-display font-bold tabular-nums text-white">{formatMoney(j.amount, "fr-FR", 0)}</span>
                </button>
                <div className="mt-3 flex items-center justify-between">
                  <StatusPick job={j} />
                  <span className="text-xs tabular-nums text-slate-500">{fmtDate(j.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
