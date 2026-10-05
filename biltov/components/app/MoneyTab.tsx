"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlarmClock, ArrowDownRight, ArrowUpRight, Calculator, CheckCircle2, Download, FileSpreadsheet, Landmark } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { dueReminders, STEP_LABEL } from "@/lib/app/reminders";
import { cashed, cashForecast, paymentsJournal, pendingQuotes, periodRange, purchaseJournal, receivables, retentionsHeld, salesJournal, toCsv, toInvoiceByJob, vatGrids, type Bucket, type Period } from "@/lib/app/finance";
import { downloadBlob } from "@/lib/app/send";
import { workbookBlob } from "@/lib/app/catalog/import";
import { todayIso } from "@/lib/app/defaults";
import type { Doc } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Field, Notice, PageHeader, Stat, SubTabs, Toggle, inputClass } from "./ui";
import { SendDialog } from "./SendDialog";

const BUCKETS: { id: Bucket; label: string; tone: string }[] = [
  { id: "notDue", label: "Pas encore échu", tone: "bg-emerald" },
  { id: "d30", label: "1 à 30 jours de retard", tone: "bg-amber-400" },
  { id: "d60", label: "31 à 60 jours", tone: "bg-orange-500" },
  { id: "d60plus", label: "Plus de 60 jours", tone: "bg-rose-500" },
];

const GRID_HELP: Record<string, string> = {
  "00": "Opérations à 0 % / exonérées",
  "01": "Opérations à 6 %",
  "02": "Opérations à 12 %",
  "03": "Opérations à 21 %",
  "45": "Opérations avec TVA due par le cocontractant (autoliquidation)",
  "49": "Notes de crédit émises",
  "54": "TVA due sur les grilles 01, 02 et 03",
  "56": "TVA due sur les achats en autoliquidation (grille 87)",
  "59": "TVA déductible",
  "64": "TVA à récupérer sur les notes de crédit émises",
  "81": "Achats de marchandises et matières",
  "82": "Services et biens divers",
  "87": "Achats en autoliquidation (sous-traitance)",
};

/** Accueil : l'argent à recevoir, en premier. */
export function MoneyTab({ onOpenDoc, onOpenJob }: { onOpenDoc: (id: string) => void; onOpenJob: (id: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [tab, setTab] = useState<"receive" | "cash" | "vat" | "export">("receive");
  const [period, setPeriod] = useState<Period>("month");
  const [reminderDoc, setReminderDoc] = useState<Doc | null>(null);
  const [bucket, setBucket] = useState<Bucket | "all">("all");
  const today = todayIso();

  const rec = useMemo(() => receivables(data, today), [data, today]);
  const toInvoice = useMemo(() => toInvoiceByJob(data), [data]);
  const pending = useMemo(() => pendingQuotes(data), [data]);
  const reminders = useMemo(() => dueReminders(data, today), [data, today]);
  const cash = cashed(data, period, today);
  const retentions = retentionsHeld(data);
  const client = (d: Doc) => data.clients.find((c) => c.id === d.clientId);
  const job = (d: Doc) => data.jobs.find((j) => j.id === d.jobId);
  const rows = rec.rows.filter((r) => bucket === "all" || r.bucket === bucket);
  const delta = cash.previous ? Math.round(((cash.current - cash.previous) / cash.previous) * 100) : null;

  return (
    <div>
      <PageHeader
        title={t("Argent à recevoir")}
        subtitle={t("Ce que vos clients vous doivent, ce qu'il reste à facturer et ce qui arrive sur le compte.")}
        actions={
          <a href="#banque" className="btn-ghost !py-2.5 text-sm">
            <Landmark className="h-4 w-4" /> {t("Importer un extrait CODA")}
          </a>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("À encaisser (TVAC)")} value={f.money0(rec.total)} sub={t("{n} facture(s) ouverte(s)", { n: rec.rows.length })} tone={rec.buckets.d60plus > 0 ? "danger" : rec.total - rec.buckets.notDue > 0 ? "warn" : "ok"} />
        <Stat label={t("Signé, pas encore facturé (HTVA)")} value={f.money0(toInvoice.reduce((s, r) => s + r.amount, 0))} sub={t("{n} chantier(s)", { n: toInvoice.length })} />
        <Stat label={t("Devis en attente (HTVA)")} value={f.money0(pending.gross)} sub={t("pondéré : {p}", { p: f.money0(pending.weighted) })} />
        <Stat
          label={period === "month" ? t("Encaissé ce mois") : period === "quarter" ? t("Encaissé ce trimestre") : t("Encaissé cette année")}
          value={f.money0(cash.current)}
          sub={delta === null ? t("précédent : {p}", { p: f.money0(cash.previous) }) : `${delta >= 0 ? "+" : ""}${delta} % ${t("vs période précédente")}`}
          onClick={() => setPeriod((p) => (p === "month" ? "quarter" : p === "quarter" ? "year" : "month"))}
        />
      </div>

      <div className="mb-6">
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "receive", label: t("À encaisser"), count: rec.rows.length },
          { id: "cash", label: t("Trésorerie") },
          { id: "vat", label: t("Aide TVA") },
          { id: "export", label: t("Exports comptables") },
        ]}
      />
      </div>

      {tab === "receive" && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="min-w-0 space-y-6">
            <div className="card p-5">
              <p className="mb-3 text-sm font-semibold text-slate-200">{t("Ancienneté des créances")}</p>
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-white/5">
                {BUCKETS.map((b) => (rec.total ? <span key={b.id} className={b.tone} style={{ width: `${(rec.buckets[b.id] / rec.total) * 100}%` }} /> : null))}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {BUCKETS.map((b) => (
                  <button key={b.id} onClick={() => setBucket((x) => (x === b.id ? "all" : b.id))} className={cn("rounded-xl border p-3 text-left transition-colors", bucket === b.id ? "border-cyan/60 bg-cyan/5" : "border-white/10 hover:border-white/20")}>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      <span className={cn("h-2 w-2 rounded-full", b.tone)} /> {t(b.label)}
                    </span>
                    <span className="mt-1 block font-display text-lg font-bold tabular-nums text-white">{f.money0(rec.buckets[b.id])}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              {!rows.length ? (
                <p className="flex items-center gap-2 p-6 text-sm text-emerald">
                  <CheckCircle2 className="h-4 w-4" /> {t("Aucune facture en attente de paiement.")}
                </p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {rows.map((r) => {
                    const rs = reminders.find((x) => x.doc.id === r.doc.id);
                    return (
                      <li key={r.doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <button onClick={() => onOpenDoc(r.doc.id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate font-semibold text-slate-100">
                            {client(r.doc)?.name} <span className="font-normal text-slate-500">· {r.doc.number}</span>
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {job(r.doc)?.name} · {t("échéance")} {f.date(r.doc.dueDate)}
                            {r.late > 0 && <span className="text-amber-300"> · {t("{n} j de retard", { n: r.late })}</span>}
                            {r.paid > 0 && <span className="text-cyan"> · {t("payé {p}", { p: f.money(r.paid) })}</span>}
                            {r.disputed && <span className="text-rose-300"> · {t("litige")}</span>}
                          </p>
                        </button>
                        <span className="font-semibold tabular-nums text-white">{f.money(r.due)}</span>
                        {rs && (
                          <button onClick={() => setReminderDoc(r.doc)} className="btn-primary !px-3 !py-1.5 text-xs">
                            <AlarmClock className="h-3.5 w-3.5" /> {t(STEP_LABEL(rs))}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div className="card p-5">
              <p className="mb-3 text-sm font-semibold text-slate-200">{t("Reste à facturer par chantier")}</p>
              {!toInvoice.length ? (
                <p className="text-sm text-slate-500">{t("Tout le signé est facturé.")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {toInvoice.slice(0, 8).map((r) => (
                    <li key={r.job.id}>
                      <button onClick={() => onOpenJob(r.job.id)} className="flex w-full justify-between gap-3 text-left hover:text-cyan">
                        <span className="truncate text-slate-300">{r.job.name}</span>
                        <span className="tabular-nums text-white">{f.money0(r.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card space-y-2 p-5 text-sm">
              <p className="flex justify-between">
                <span className="text-slate-400">{t("Retenues de garantie détenues par les clients")}</span>
                <span className="tabular-nums text-white">{f.money0(retentions)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400">{t("Paiements partiels")}</span>
                <span className="tabular-nums text-white">{rec.partial.length}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400">{t("Relances à envoyer")}</span>
                <span className="tabular-nums text-amber-300">{reminders.length}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "cash" && <CashForecast />}
      {tab === "vat" && <VatHelp />}
      {tab === "export" && <Exports />}

      <AnimatePresence>
        {reminderDoc && <SendDialog doc={reminderDoc} reminder onClose={() => setReminderDoc(null)} />}
      </AnimatePresence>
    </div>
  );
}

function CashForecast() {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [opening, setOpening] = useState(0);
  const rows = cashForecast(data, 13, todayIso(), opening);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inflow, r.outflow)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t("Solde bancaire actuel")} className="w-56">
          <input type="number" className={inputClass} value={opening || ""} onChange={(e) => setOpening(e.target.valueAsNumber || 0)} placeholder="0" />
        </Field>
        <p className="max-w-xl pb-2 text-xs text-slate-500">{t("Prévision sur 13 semaines : échéances des factures clients (hors litiges) moins les factures fournisseurs à payer. Les retards de paiement réels décaleront ces montants.")}</p>
      </div>
      <div className="card overflow-x-auto p-5">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="pb-2">{t("Semaine du")}</th>
              <th className="pb-2">{t("Entrées")}</th>
              <th className="pb-2">{t("Sorties")}</th>
              <th className="pb-2 text-right">{t("Solde prévu")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.from}>
                <td className="py-2 text-slate-300">{f.date(r.from)}</td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-full bg-emerald" style={{ width: `${(r.inflow / max) * 120}px` }} />
                    <span className="tabular-nums text-emerald">
                      <ArrowDownRight className="inline h-3 w-3" /> {f.money0(r.inflow)}
                    </span>
                  </span>
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-full bg-rose-500" style={{ width: `${(r.outflow / max) * 120}px` }} />
                    <span className="tabular-nums text-rose-300">
                      <ArrowUpRight className="inline h-3 w-3" /> {f.money0(r.outflow)}
                    </span>
                  </span>
                </td>
                <td className={cn("py-2 text-right font-semibold tabular-nums", r.balance < 0 ? "text-rose-400" : "text-white")}>{f.money0(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VatHelp() {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [offset, setOffset] = useState(0);
  const [monthly, setMonthly] = useState(false);
  const range = periodRange(monthly ? "month" : "quarter", todayIso(), offset);
  const r = vatGrids(data, range.from, range.to);
  const keys = Object.keys(r.grids).sort();
  if (data.company.vatRegime === "franchise")
    return <Notice>{t("Régime de la franchise : pas de déclaration TVA périodique ni de TVA portée en compte sur vos factures.")}</Notice>;
  return (
    <div className="space-y-4">
      <Notice tone="warn">{t("Aide à la déclaration, calculée à partir des documents enregistrés dans Biltov. À valider par votre comptable avant tout dépôt sur Intervat.")}</Notice>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setOffset((o) => o - 1)} className="btn-ghost !py-2 text-sm">←</button>
        <span className="text-sm font-semibold text-white">
          {f.date(range.from)} → {f.date(new Date(Date.parse(range.to) - 864e5).toISOString().slice(0, 10))}
        </span>
        <button onClick={() => setOffset((o) => Math.min(0, o + 1))} className="btn-ghost !py-2 text-sm">→</button>
        <div className="w-64">
          <Toggle checked={monthly} onChange={setMonthly} label={t("Déclarant mensuel")} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card p-5">
          {!keys.length ? (
            <p className="text-sm text-slate-500">{t("Aucune opération sur cette période.")}</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {keys.map((k) => (
                <li key={k} className="flex items-center gap-3 py-2">
                  <span className="w-10 rounded-md bg-white/5 py-0.5 text-center font-mono text-xs text-cyan">{k}</span>
                  <span className="flex-1 text-slate-300">{t(GRID_HELP[k] ?? k)}</span>
                  <span className="tabular-nums text-white">{f.money(r.grids[k])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">{r.toPay >= 0 ? t("TVA à payer (grille 71)") : t("TVA à récupérer (grille 72)")}</p>
            <p className="mt-1 flex items-center gap-2 font-display text-3xl font-bold tabular-nums text-white">
              <Calculator className="h-6 w-6 text-cyan" /> {f.money(Math.abs(r.toPay))}
            </p>
          </div>
          {r.notes.map((n) => (
            <Notice key={n}>{t(n)}</Notice>
          ))}
        </div>
      </div>
    </div>
  );
}

function Exports() {
  const { t } = useTr();
  const { data } = useAppData();
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(todayIso());
  const end = new Date(Date.parse(to) + 864e5).toISOString().slice(0, 10);
  const name = (k: string, ext: string) => `biltov-${k}-${from}_${to}.${ext}`;
  const sets = [
    { id: "ventes", label: t("Journal des ventes"), get: () => salesJournal(data, from, end) },
    { id: "achats", label: t("Journal des achats et frais"), get: () => purchaseJournal(data, from, end) },
    { id: "paiements", label: t("Paiements reçus"), get: () => paymentsJournal(data, from, end) },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Field label={t("Du")} className="w-48">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("Au")} className="w-48">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {sets.map((s) => {
          const j = s.get();
          return (
            <div key={s.id} className="card space-y-3 p-5">
              <p className="font-semibold text-white">{s.label}</p>
              <p className="text-xs text-slate-500">{t("{n} ligne(s)", { n: j.rows.length })}</p>
              <div className="flex gap-2">
                <button onClick={() => downloadBlob(new Blob([toCsv(j.headers, j.rows)], { type: "text/csv;charset=utf-8" }), name(s.id, "csv"))} className="btn-ghost flex-1 !py-2 text-sm">
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button onClick={async () => downloadBlob(await workbookBlob([{ name: s.label.slice(0, 30), headers: j.headers, rows: j.rows }]), name(s.id, "xlsx"))} className="btn-ghost flex-1 !py-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Notice>{t("Format CSV belge (séparateur « ; », décimales à virgule) importable dans la plupart des logiciels comptables (Winbooks, BOB, Exact, Horus…) après correspondance des colonnes. Un connecteur direct nécessitera le serveur.")}</Notice>
    </div>
  );
}
