"use client";

import { ArrowRight, CheckCircle2, Clock, HardHat, Percent, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUSES, STATUS_COLOR, type Job } from "@/lib/jobs";
import { formatMoney } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

const WON = new Set(["accepted", "in_progress", "done"]);

export function Overview({ jobs, onSeeAll, onOpen, onAdd }: { jobs: Job[]; onSeeAll: () => void; onOpen: (job: Job) => void; onAdd: () => void }) {
  const { t, locale } = useI18n();
  const d = t.dashboard;

  const won = jobs.filter((j) => WON.has(j.status));
  const decided = won.length + jobs.filter((j) => j.status === "refused").length;
  const pending = jobs.filter((j) => j.status === "sent");
  const kpis = [
    { icon: HardHat, label: d.kpis.jobs, value: String(jobs.length) },
    { icon: Clock, label: d.kpis.pending, value: String(pending.length), sub: formatMoney(pending.reduce((s, j) => s + j.amount, 0), locale, 0) },
    { icon: CheckCircle2, label: d.kpis.accepted, value: formatMoney(won.reduce((s, j) => s + j.amount, 0), locale, 0) },
    { icon: Percent, label: d.kpis.conversion, value: decided ? `${Math.round((won.length / decided) * 100)} %` : "—" },
  ];

  const counts = STATUSES.map((s) => ({ status: s, n: jobs.filter((j) => j.status === s).length })).filter((c) => c.n > 0);
  const recent = [...jobs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{d.hello}</h1>
          <p className="mt-1 text-slate-400">{d.intro}</p>
        </div>
        <button onClick={onAdd} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> {d.list.add}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="card p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue/15">
              <Icon className="h-4 w-4 text-cyan" />
            </span>
            <p className="mt-4 text-xs text-slate-400">{label}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl">{value}</p>
            {sub && <p className="text-xs text-slate-500 tabular-nums">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-white">{d.byStatus}</h2>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/5" role="img" aria-label={counts.map((c) => `${d.statuses[c.status]} ${c.n}`).join(", ")}>
            {counts.map((c) => (
              <span key={c.status} style={{ width: `${(c.n / jobs.length) * 100}%`, background: STATUS_COLOR[c.status] }} className="h-full border-r-2 border-ink last:border-r-0" />
            ))}
          </div>
          <ul className="mt-5 space-y-2.5">
            {STATUSES.map((s) => {
              const n = jobs.filter((j) => j.status === s).length;
              return (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                    {d.statuses[s]}
                  </span>
                  <span className="font-semibold tabular-nums text-white">{n}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">{d.recent}</h2>
            <button onClick={onSeeAll} className="flex items-center gap-1 text-sm font-semibold text-cyan hover:text-white">
              {d.seeAll} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-4 divide-y divide-white/5">
            {recent.map((j) => (
              <li key={j.id}>
                <button onClick={() => onOpen(j)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-100">{j.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {j.client} · {j.city} · {new Date(`${j.date}T00:00:00`).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <StatusBadge status={j.status} className="hidden sm:inline-flex" />
                  <span className="w-24 text-right font-semibold tabular-nums text-white">{formatMoney(j.amount, locale, 0)}</span>
                </button>
              </li>
            ))}
            {recent.length === 0 && <li className="py-6 text-center text-sm text-slate-500">{d.list.emptyAll}</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
