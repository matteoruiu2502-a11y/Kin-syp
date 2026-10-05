"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlarmClock, Download, FileText, Send } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { docVisible } from "@/lib/app/permissions";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { computeTotals } from "@/lib/app/money";
import { DOC_STATUS } from "@/lib/app/labels";
import { dueReminders, STEP_LABEL } from "@/lib/app/reminders";
import { docTitle } from "@/lib/app/pdf";
import { downloadBlob } from "@/lib/app/send";
import { todayIso } from "@/lib/app/defaults";
import { workbookBlob } from "@/lib/app/catalog/import";
import { VAT_LABEL } from "@/lib/app/labels";
import type { Doc } from "@/lib/app/types";
import { Badge, DataTable, PageHeader, SearchBox, Stat, SubTabs } from "./ui";
import { SendDialog } from "./SendDialog";
import { VoiceQuoteButton } from "./VoiceQuoteChat";

type Filter = "quotes" | "open" | "paid" | "draft" | "credit" | "templates" | "all";

export function DocsTab({ onOpenDoc, initial = "open" }: { onOpenDoc: (id: string) => void; initial?: Filter }) {
  const { t } = useTr();
  const f = useFmt();
  const { data: full, perms } = useAppData();
  // seuls les documents autorisés (devis / factures) sont listés
  const data = useMemo(() => ({ ...full, docs: full.docs.filter(docVisible(perms)) }), [full, perms]);
  const [filter, setFilter] = useState<Filter>(initial);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" as "asc" | "desc" });
  const [reminderDoc, setReminderDoc] = useState<Doc | null>(null);
  const today = todayIso();
  const client = (d: Doc) => data.clients.find((c) => c.id === d.clientId);
  const job = (d: Doc) => data.jobs.find((j) => j.id === d.jobId);
  const due = dueReminders(data, today);

  const sets: Record<Filter, Doc[]> = useMemo(
    () => ({
      quotes: data.docs.filter((d) => d.type === "quote" && !d.template),
      open: data.docs.filter((d) => d.type === "invoice" && d.lockedAt && (d.status === "issued" || d.status === "partial")),
      paid: data.docs.filter((d) => d.status === "paid"),
      draft: data.docs.filter((d) => d.type !== "quote" && !d.lockedAt),
      credit: data.docs.filter((d) => d.type === "credit"),
      templates: data.docs.filter((d) => d.template),
      all: data.docs,
    }),
    [data.docs],
  );
  const s = q.trim().toLowerCase();
  const rows = sets[filter].filter((d) => !s || [d.number ?? "", client(d)?.name ?? "", job(d)?.name ?? "", d.structuredComm].some((x) => x.toLowerCase().includes(s)));
  const outstanding = sets.open.reduce((a, d) => a + computeTotals(d).due, 0);
  const late = sets.open.filter((d) => d.dueDate < today);

  const exportJournal = async () => {
    const issued = data.docs.filter((d) => d.lockedAt).sort((a, b) => (a.number ?? "").localeCompare(b.number ?? ""));
    const rowsX = issued.map((d) => {
      const tt = computeTotals(d);
      const sign = d.type === "credit" ? -1 : 1;
      const c = client(d);
      return [d.number ?? "", docTitle(d, "fr"), d.issueDate, c?.name ?? "", c?.vatNumber ?? "", ...["21", "12", "6", "0", "reverse"].flatMap((code) => {
        const r = tt.vatRows.find((x) => x.code === code);
        return [sign * (r?.base ?? 0), sign * (r?.vat ?? 0)];
      }), sign * tt.htva, sign * tt.vat, sign * tt.tvac, d.dueDate, t(DOC_STATUS[d.status].label), d.structuredComm, d.peppol.status];
    });
    const heads = ["Numéro", "Type", "Date", "Client", "TVA client", ...["21", "12", "6", "0", "reverse"].flatMap((c) => [`Base ${VAT_LABEL[c as "21"]}`, `TVA ${VAT_LABEL[c as "21"]}`]), "Total HTVA", "TVA", "Total TVAC", "Échéance", "Statut", "Communication", "Peppol"];
    downloadBlob(await workbookBlob([{ name: "Journal des ventes", headers: heads, rows: rowsX }]), `journal-ventes-${today}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        title={t("Devis & factures")}
        subtitle={t("Numérotation continue · documents émis immuables · notes de crédit pour toute correction")}
        actions={
          <>
          <VoiceQuoteButton />
          <button onClick={exportJournal} className="btn-ghost !py-2.5 text-sm">
            <Download className="h-4 w-4" /> {t("Journal des ventes (Excel)")}
          </button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("À encaisser (TVAC)")} value={f.money(outstanding)} sub={t("{n} facture(s)", { n: sets.open.length })} onClick={() => setFilter("open")} />
        <Stat label={t("En retard")} value={String(late.length)} sub={f.money(late.reduce((a, d) => a + computeTotals(d).due, 0))} tone={late.length ? "warn" : undefined} onClick={() => setFilter("open")} />
        <Stat label={t("Devis en attente")} value={String(sets.quotes.filter((d) => d.status === "sent" || d.status === "viewed").length)} sub={f.money(sets.quotes.filter((d) => d.status === "sent").reduce((a, d) => a + computeTotals(d).tvac, 0))} onClick={() => setFilter("quotes")} />
      </div>

      {due.length > 0 && (
        <section className="card glow-border mb-6 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <AlarmClock className="h-5 w-5 text-amber-300" /> {t("Relances à envoyer")}
          </h2>
          <ul className="mt-4 space-y-2">
            {due.map((r) => (
              <li key={r.doc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100">
                    {r.doc.number} · {r.client?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t(STEP_LABEL(r))} · {t("échéance")} {f.date(r.doc.dueDate)} · {f.money(computeTotals(r.doc).due)}
                    {r.fees + r.interest > 0 && ` · +${f.money(r.fees + r.interest)} ${t("frais et intérêts")}`}
                  </p>
                </div>
                <button onClick={() => setReminderDoc(r.doc)} className="btn-primary !py-2 text-sm">
                  <Send className="h-4 w-4" /> {t("Relancer")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 space-y-3">
        <SubTabs<Filter>
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: "open", label: t("À encaisser"), count: sets.open.length },
            { id: "quotes", label: t("Devis"), count: sets.quotes.length },
            { id: "paid", label: t("Payées"), count: sets.paid.length },
            { id: "draft", label: t("Brouillons"), count: sets.draft.length },
            { id: "credit", label: t("Notes de crédit"), count: sets.credit.length },
            { id: "templates", label: t("Modèles"), count: sets.templates.length },
            { id: "all", label: t("Tout"), count: data.docs.length },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher : numéro, client, chantier, communication…")} />
      </div>

      <DataTable
        rows={rows}
        onRow={(d) => onOpenDoc(d.id)}
        sort={sort}
        onSort={(key) => setSort((x) => ({ key, dir: x.key === key && x.dir === "asc" ? "desc" : "asc" }))}
        cols={[
          { key: "number", label: t("Numéro"), sort: (d) => d.number ?? "", render: (d) => <span className="font-semibold text-slate-100"><FileText className="mr-2 inline h-4 w-4 text-cyan" />{docTitle(d, "fr").charAt(0) + docTitle(d, "fr").slice(1).toLowerCase()} {d.number ?? t("(brouillon)")}</span> },
          { key: "client", label: t("Client"), sort: (d) => client(d)?.name ?? "", render: (d) => <span className="text-slate-300">{client(d)?.name}</span> },
          { key: "job", label: t("Chantier"), sort: (d) => job(d)?.name ?? "", render: (d) => <span className="text-slate-400">{job(d)?.name}</span> },
          { key: "date", label: t("Date"), sort: (d) => d.issueDate, render: (d) => <span className="tabular-nums text-slate-400">{f.date(d.issueDate)}</span> },
          { key: "due", label: t("Échéance"), sort: (d) => d.dueDate, render: (d) => (d.type === "invoice" && d.lockedAt ? <span className={d.dueDate < today && d.status !== "paid" ? "tabular-nums text-amber-300" : "tabular-nums text-slate-400"}>{f.date(d.dueDate)}</span> : "—") },
          { key: "status", label: t("Statut"), sort: (d) => d.status, render: (d) => <Badge label={t(DOC_STATUS[d.status].label)} style={DOC_STATUS[d.status].style} /> },
          { key: "amount", label: t("Montant TVAC"), sort: (d) => computeTotals(d).tvac, render: (d) => <span className="font-semibold tabular-nums">{d.type === "credit" ? "- " : ""}{f.money(computeTotals(d).tvac)}</span>, className: "text-right" },
        ]}
        empty={t("Aucun document ici.")}
      />
      <AnimatePresence>{reminderDoc && <SendDialog doc={data.docs.find((d) => d.id === reminderDoc.id)!} reminder onClose={() => setReminderDoc(null)} />}</AnimatePresence>
    </div>
  );
}
