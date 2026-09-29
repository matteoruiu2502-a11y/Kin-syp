"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Download, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUSES, jobsToCsv, newId, today, type Job, type JobStatus } from "@/lib/jobs";
import type { TradeId } from "@/lib/content/fr";
import { cn, formatMoney } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

type SortKey = "name" | "client" | "city" | "trade" | "amount" | "status" | "date";

type Props = {
  jobs: Job[];
  ready: boolean;
  onAdd: () => void;
  onEdit: (job: Job) => void;
  onSave: (job: Job) => void;
  onRemove: (id: string) => void;
  onResetDemo: () => void;
};

const inputClass = "rounded-xl border border-white/10 bg-ink/70 px-3 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-cyan";

export function JobsList({ jobs, ready, onAdd, onEdit, onSave, onRemove, onResetDemo }: Props) {
  const { t, locale } = useI18n();
  const d = t.dashboard;
  const tradeName = (id: TradeId) => t.trades.list.find((x) => x.id === id)?.name ?? id;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [trade, setTrade] = useState<TradeId | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    const list = jobs.filter(
      (j) =>
        (status === "all" || j.status === status) &&
        (trade === "all" || j.trade === trade) &&
        (!q || [j.name, j.client, j.city, j.notes].some((f) => f.toLocaleLowerCase(locale).includes(q))),
    );
    const cmp = (a: Job, b: Job) => {
      switch (sortKey) {
        case "amount":
          return a.amount - b.amount;
        case "date":
          return a.date.localeCompare(b.date);
        case "status":
          return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
        case "trade":
          return collator.compare(tradeName(a.trade), tradeName(b.trade));
        default:
          return collator.compare(a[sortKey], b[sortKey]);
      }
    };
    return list.sort((a, b) => (dir === "asc" ? cmp(a, b) : -cmp(a, b)) || collator.compare(a.name, b.name));
  }, [jobs, query, status, trade, sortKey, dir, locale, t]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDir((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "amount" || key === "date" ? "desc" : "asc");
    }
  };

  const exportCsv = () => {
    const f = d.fields;
    const csv = jobsToCsv(visible, [f.name, f.client, f.city, f.trade, f.amount, f.status, f.date, f.notes], (s) => d.statuses[s], tradeName);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `biltov-chantiers-${today()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = (job: Job) => {
    if (window.confirm(`${d.list.confirmDelete}\n\n${job.name}`)) onRemove(job.id);
  };

  const duplicate = (job: Job) => onSave({ ...job, id: newId(), name: `${job.name} ${d.list.copy}`, status: "draft", date: today() });

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "name", label: d.fields.name },
    { key: "client", label: d.fields.client },
    { key: "city", label: d.fields.city, className: "hidden xl:table-cell" },
    { key: "trade", label: d.fields.trade, className: "hidden xl:table-cell" },
    { key: "amount", label: d.fields.amount, className: "text-right" },
    { key: "status", label: d.fields.status },
    { key: "date", label: d.fields.date },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{d.tabs.jobs}</h1>
          <p className="mt-1 text-sm text-slate-400">{d.list.count.replace("{n}", String(visible.length))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={!visible.length} className="btn-ghost !px-4 !py-2.5 text-sm disabled:opacity-40">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">{d.list.export}</span>
          </button>
          <button onClick={onAdd} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> {d.list.add}
          </button>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{d.list.search}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={d.list.search} className={cn(inputClass, "w-full pl-9")} type="search" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus | "all")} className={inputClass} aria-label={d.fields.status}>
          <option value="all">{d.list.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {d.statuses[s]}
            </option>
          ))}
        </select>
        <select value={trade} onChange={(e) => setTrade(e.target.value as TradeId | "all")} className={inputClass} aria-label={d.fields.trade}>
          <option value="all">{d.list.allTrades}</option>
          {t.trades.list.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={cn(inputClass, "min-w-0 flex-1")} aria-label={d.list.sortBy}>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {d.list.sortBy} : {c.label}
              </option>
            ))}
          </select>
          <button onClick={() => setDir((x) => (x === "asc" ? "desc" : "asc"))} className={cn(inputClass, "px-3")} aria-label={dir === "asc" ? d.list.asc : d.list.desc} title={dir === "asc" ? d.list.asc : d.list.desc}>
            {dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {ready && visible.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-slate-400">{jobs.length ? d.list.empty : d.list.emptyAll}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={onAdd} className="btn-primary text-sm">
              <Plus className="h-4 w-4" /> {d.list.add}
            </button>
            {!jobs.length && (
              <button onClick={onResetDemo} className="btn-ghost text-sm">
                <RotateCcw className="h-4 w-4" /> {d.list.resetDemo}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Tableau (écrans larges) */}
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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((j) => (
                  <tr key={j.id} className="group border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <button onClick={() => onEdit(j)} className="text-left font-semibold text-slate-100 hover:text-cyan">
                        {j.name}
                      </button>
                      {j.notes && <p className="max-w-xs truncate text-xs text-slate-500">{j.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{j.client}</td>
                    <td className="hidden px-4 py-3 text-slate-400 xl:table-cell">{j.city}</td>
                    <td className="hidden px-4 py-3 text-slate-400 xl:table-cell">{tradeName(j.trade)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">{formatMoney(j.amount, locale, 0)}</td>
                    <td className="px-4 py-3">
                      <StatusSelect job={j} onSave={onSave} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-400">{new Date(`${j.date}T00:00:00`).toLocaleDateString(locale)}</td>
                    <td className="px-4 py-3">
                      <RowActions onEdit={() => onEdit(j)} onDuplicate={() => duplicate(j)} onRemove={() => remove(j)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes (mobile) */}
          <ul className="space-y-3 md:hidden">
            {visible.map((j) => (
              <li key={j.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => onEdit(j)} className="min-w-0 text-left">
                    <p className="truncate font-semibold text-slate-100">{j.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {j.client} · {j.city} · {tradeName(j.trade)}
                    </p>
                  </button>
                  <p className="shrink-0 font-display font-bold tabular-nums text-white">{formatMoney(j.amount, locale, 0)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <StatusSelect job={j} onSave={onSave} />
                  <span className="text-xs tabular-nums text-slate-500">{new Date(`${j.date}T00:00:00`).toLocaleDateString(locale)}</span>
                  <RowActions onEdit={() => onEdit(j)} onDuplicate={() => duplicate(j)} onRemove={() => remove(j)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Changement de statut en un clic, directement dans la liste. */
function StatusSelect({ job, onSave }: { job: Job; onSave: (job: Job) => void }) {
  const { t } = useI18n();
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{t.dashboard.fields.status}</span>
      <StatusBadge status={job.status} className="pointer-events-none" />
      <select value={job.status} onChange={(e) => onSave({ ...job, status: e.target.value as JobStatus })} className="absolute inset-0 cursor-pointer opacity-0">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t.dashboard.statuses[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

function RowActions({ onEdit, onDuplicate, onRemove }: { onEdit: () => void; onDuplicate: () => void; onRemove: () => void }) {
  const { t } = useI18n();
  const l = t.dashboard.list;
  const btn = "rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white";
  return (
    <div className="flex justify-end gap-0.5">
      <button onClick={onEdit} className={btn} aria-label={l.edit} title={l.edit}>
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={onDuplicate} className={btn} aria-label={l.duplicate} title={l.duplicate}>
        <Copy className="h-4 w-4" />
      </button>
      <button onClick={onRemove} className={cn(btn, "hover:text-rose-400")} aria-label={l.delete} title={l.delete}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
