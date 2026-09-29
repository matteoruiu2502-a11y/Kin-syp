"use client";

import { AlarmClock, ArrowRight, Clock, HardHat, Mic, Receipt, Wallet } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { computeTotals, eur } from "@/lib/app/money";
import { fmtDate } from "@/lib/app/legal";
import { JOB_STATUS, JOB_STATUSES } from "@/lib/app/labels";
import { dueReminders } from "@/lib/app/reminders";
import { todayIso } from "@/lib/app/defaults";
import { Badge } from "./Badge";

export function OverviewTab({ onAdd, onOpenJob, go }: { onAdd: () => void; onOpenJob: (id: string) => void; go: (tab: "jobs" | "invoices") => void }) {
  const { data } = useAppData();
  const today = todayIso();
  const vatOn = (jobId: string) => data.company.vatMode === "normal" && !data.jobs.find((j) => j.id === jobId)?.reverseCharge;
  const pendingQuotes = data.docs.filter((d) => d.type === "quote" && d.status === "sent");
  const open = data.docs.filter((d) => d.type === "invoice" && d.status === "issued");
  const year = today.slice(0, 4);
  const billed = data.docs
    .filter((d) => d.lockedAt && d.issueDate.startsWith(year) && d.type !== "quote")
    // les acomptes sont repris dans la facture de solde : on ne les compte qu'une fois
    .filter((d) => !(d.kind === "deposit" && data.docs.some((x) => x.sourceId === d.sourceId && x.kind === "balance" && x.lockedAt)))
    .reduce((s, d) => s + (d.type === "credit" ? -1 : 1) * computeTotals(d, vatOn(d.jobId)).ht, 0);
  const reminders = dueReminders(data.docs, data.jobs, today);
  const active = data.jobs.filter((j) => j.status === "accepted" || j.status === "in_progress").length;
  const recent = [...data.jobs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const kpis = [
    { icon: HardHat, label: "Chantiers actifs", value: String(active), sub: `${data.jobs.length} au total` },
    { icon: Clock, label: "Devis en attente de réponse", value: String(pendingQuotes.length), sub: eur(pendingQuotes.reduce((s, d) => s + computeTotals(d, vatOn(d.jobId)).ttc, 0)) + " TTC" },
    { icon: Receipt, label: `Facturé HT en ${year}`, value: eur(billed) },
    { icon: Wallet, label: "À encaisser", value: eur(open.reduce((s, d) => s + computeTotals(d, vatOn(d.jobId)).due, 0)), sub: `${open.length} facture(s)` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Bonjour {data.company.owner.split(" ")[0] || ""} 👋</h1>
          <p className="mt-1 text-slate-400">Voici où en sont vos chantiers, devis et factures.</p>
        </div>
        <button onClick={onAdd} className="btn-primary text-sm">
          <Mic className="h-4 w-4" /> Nouveau chantier dicté
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="card p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue/15">
              <Icon className="h-4 w-4 text-cyan" />
            </span>
            <p className="mt-4 text-xs text-slate-400">{label}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-white">{value}</p>
            {sub && <p className="text-xs tabular-nums text-slate-500">{sub}</p>}
          </div>
        ))}
      </div>

      {reminders.length > 0 && (
        <button onClick={() => go("invoices")} className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-left text-sm text-amber-200">
          <AlarmClock className="h-5 w-5 shrink-0" />
          <span className="flex-1">
            <strong>{reminders.length} relance(s) d&apos;impayé à envoyer aujourd&apos;hui.</strong> Messages prêts, en un clic.
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-white">Répartition des chantiers</h2>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/5">
            {JOB_STATUSES.map((s) => {
              const n = data.jobs.filter((j) => j.status === s).length;
              return n ? <span key={s} style={{ width: `${(n / data.jobs.length) * 100}%`, background: JOB_STATUS[s].color }} className="h-full border-r-2 border-ink last:border-r-0" /> : null;
            })}
          </div>
          <ul className="mt-5 space-y-2.5">
            {JOB_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: JOB_STATUS[s].color }} />
                  {JOB_STATUS[s].label}
                </span>
                <span className="font-semibold tabular-nums text-white">{data.jobs.filter((j) => j.status === s).length}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-white">Derniers chantiers</h2>
            <button onClick={() => go("jobs")} className="flex items-center gap-1 text-sm font-semibold text-cyan hover:text-white">
              Tout voir <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-4 divide-y divide-white/5">
            {recent.map((j) => (
              <li key={j.id}>
                <button onClick={() => onOpenJob(j.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-100">{j.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {j.client} · {fmtDate(j.date)}
                    </p>
                  </div>
                  <Badge {...JOB_STATUS[j.status]} className="hidden sm:inline-flex" />
                  <span className="w-24 text-right font-semibold tabular-nums text-white">{eur(j.amount)}</span>
                </button>
              </li>
            ))}
            {!recent.length && <li className="py-8 text-center text-sm text-slate-500">Aucun chantier pour l&apos;instant.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
