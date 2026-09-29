"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlarmClock, Download, FileText, Send } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { computeTotals, eur } from "@/lib/app/money";
import { fmtDate } from "@/lib/app/legal";
import { DOC_STATUS } from "@/lib/app/labels";
import { dueReminders, REMINDER_STEPS } from "@/lib/app/reminders";
import { docTitle } from "@/lib/app/pdf";
import { downloadBlob } from "@/lib/app/send";
import { todayIso } from "@/lib/app/defaults";
import type { Doc } from "@/lib/app/types";
import { Badge } from "./Badge";
import { Empty, SubTabs } from "./ui";
import { SendDialog } from "./SendDialog";

type Filter = "open" | "paid" | "draft" | "credit" | "all";

export function InvoicesTab({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { data } = useAppData();
  const [filter, setFilter] = useState<Filter>("open");
  const [reminder, setReminder] = useState<{ doc: Doc; step: number } | null>(null);
  const today = todayIso();
  const all = useMemo(() => data.docs.filter((d) => d.type !== "quote"), [data.docs]);
  const job = (d: Doc) => data.jobs.find((j) => j.id === d.jobId);
  const vatOn = (d: Doc) => data.company.vatMode === "normal" && !job(d)?.reverseCharge;
  const due = dueReminders(data.docs, data.jobs, today);

  const sets: Record<Filter, Doc[]> = {
    open: all.filter((d) => d.type === "invoice" && d.status === "issued"),
    paid: all.filter((d) => d.status === "paid"),
    draft: all.filter((d) => !d.lockedAt),
    credit: all.filter((d) => d.type === "credit"),
    all,
  };
  const list = [...sets[filter]].sort((a, b) => (b.number ?? "~").localeCompare(a.number ?? "~"));
  const outstanding = sets.open.reduce((s, d) => s + computeTotals(d, vatOn(d)).due, 0);
  const late = sets.open.filter((d) => d.dueDate < today);
  const cashed = sets.paid.filter((d) => d.paidAt?.slice(0, 4) === today.slice(0, 4)).reduce((s, d) => s + computeTotals(d, vatOn(d)).due, 0);

  const exportJournal = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const n = (x: number) => x.toFixed(2).replace(".", ",");
    const head = ["Numéro", "Type", "Date", "Client", "SIREN client", "Chantier", "Total HT", "TVA", "Total TTC", "Échéance", "Statut", "Payée le", "Moyen"];
    const rows = all
      .filter((d) => d.lockedAt)
      .sort((a, b) => (a.number ?? "").localeCompare(b.number ?? ""))
      .map((d) => {
        const t = computeTotals(d, vatOn(d));
        const sign = d.type === "credit" ? -1 : 1;
        const j = job(d);
        return [d.number ?? "", docTitle(d), d.issueDate, j?.client ?? "", j?.clientSiren ?? "", j?.name ?? "", n(sign * t.ht), n(sign * t.vat), n(sign * t.ttc), d.type === "invoice" ? d.dueDate : "", DOC_STATUS[d.status].label, d.paidAt ?? "", d.paymentMethod]
          .map(esc)
          .join(";");
      });
    downloadBlob(new Blob(["﻿" + [head.map(esc).join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }), `journal-des-ventes-${today}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Factures &amp; relances</h1>
          <p className="mt-1 text-sm text-slate-400">Numérotation continue, factures émises non modifiables, avoirs pour toute correction.</p>
        </div>
        <button onClick={exportJournal} className="btn-ghost !py-2.5 text-sm" title="Pour votre comptable">
          <Download className="h-4 w-4" /> Journal des ventes (CSV)
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs text-slate-400">À encaisser</p>
          <p className="font-display text-3xl font-bold tabular-nums text-white">{eur(outstanding)}</p>
          <p className="text-xs text-slate-500">{sets.open.length} facture(s)</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-400">En retard</p>
          <p className="font-display text-3xl font-bold tabular-nums text-amber-300">{late.length}</p>
          <p className="text-xs text-slate-500">{eur(late.reduce((s, d) => s + computeTotals(d, vatOn(d)).due, 0))}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-400">Encaissé en {today.slice(0, 4)}</p>
          <p className="font-display text-3xl font-bold tabular-nums text-emerald">{eur(cashed)}</p>
        </div>
      </div>

      {due.length > 0 && (
        <section className="card glow-border p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <AlarmClock className="h-5 w-5 text-amber-300" /> Relances à envoyer aujourd&apos;hui
          </h2>
          <ul className="mt-4 space-y-2">
            {due.map((r) => (
              <li key={r.doc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100">
                    {r.doc.number} · {r.job.client}
                  </p>
                  <p className="text-xs text-slate-500">
                    {REMINDER_STEPS[r.step].title} (J+{REMINDER_STEPS[r.step].day}) · échue depuis {r.overdueDays} j · {eur(computeTotals(r.doc, vatOn(r.doc)).due)}
                  </p>
                </div>
                <button onClick={() => setReminder({ doc: r.doc, step: r.step })} className="btn-primary !py-2 text-sm">
                  <Send className="h-4 w-4" /> Relancer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SubTabs<Filter>
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "open", label: "À encaisser", count: sets.open.length },
          { id: "paid", label: "Payées", count: sets.paid.length },
          { id: "draft", label: "Brouillons", count: sets.draft.length },
          { id: "credit", label: "Avoirs", count: sets.credit.length },
          { id: "all", label: "Tout", count: all.length },
        ]}
      />

      {list.length === 0 ? (
        <Empty icon={FileText} text="Aucune facture ici. Les factures se créent depuis un devis signé (bouton « Facturer »)." />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
          {list.map((d) => {
            const j = job(d);
            const t = computeTotals(d, vatOn(d));
            const overdue = d.status === "issued" && d.dueDate < today;
            return (
              <li key={d.id}>
                <button onClick={() => onOpenDoc(d.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03]">
                  <FileText className="h-5 w-5 shrink-0 text-cyan" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-100">
                      {docTitle(d).charAt(0) + docTitle(d).slice(1).toLowerCase()} {d.number ?? "(brouillon)"} · {j?.client}
                    </p>
                    <p className={overdue ? "text-xs text-amber-300" : "text-xs text-slate-500"}>
                      {j?.name} · {d.lockedAt ? `émise le ${fmtDate(d.issueDate)}` : "non émise"}
                      {d.type === "invoice" && d.lockedAt ? ` · échéance ${fmtDate(d.dueDate)}` : ""}
                    </p>
                  </div>
                  <Badge {...DOC_STATUS[d.status]} className="hidden sm:inline-flex" />
                  <span className="w-28 text-right font-semibold tabular-nums text-white">
                    {d.type === "credit" ? "- " : ""}
                    {eur(t.due)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>{reminder && <SendDialog doc={data.docs.find((x) => x.id === reminder.doc.id)!} reminderStep={reminder.step} onClose={() => setReminder(null)} />}</AnimatePresence>
    </div>
  );
}
