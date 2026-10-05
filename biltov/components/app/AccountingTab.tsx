"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileArchive, FileCode2, FileSpreadsheet, Save } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { entriesCsv, isBalanced, journalEntries, retentionsToTransfer, winbooksAct, winbooksCsf } from "@/lib/app/accounting";
import { toCsv } from "@/lib/app/finance";
import { buildUbl } from "@/lib/app/peppol/ubl";
import { downloadBlob } from "@/lib/app/send";
import { workbookBlob } from "@/lib/app/catalog/import";
import { round2 } from "@/lib/app/money";
import type { AccountingSettings } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Field, Notice, PageHeader, Stat, SubTabs, inputClass } from "./ui";

const ACCOUNT_FIELDS: { key: keyof AccountingSettings; label: string }[] = [
  { key: "salesJournal", label: "Journal des ventes" },
  { key: "purchasesJournal", label: "Journal des achats" },
  { key: "bankJournal", label: "Journal financier" },
  { key: "sales", label: "Ventes (classe 70)" },
  { key: "customers", label: "Clients (400)" },
  { key: "purchases", label: "Approvisionnements (600)" },
  { key: "subcontracting", label: "Sous-traitance (604)" },
  { key: "generalExpenses", label: "Frais généraux (61)" },
  { key: "suppliers", label: "Fournisseurs (440)" },
  { key: "vatDue", label: "TVA due (451)" },
  { key: "vatDeductible", label: "TVA déductible (411)" },
  { key: "bank", label: "Banque (55)" },
];

const zipBlob = async (files: { name: string; data: string | Uint8Array }[]) => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return zip.generateAsync({ type: "blob" });
};

export function AccountingTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, update } = useAppData();
  const [tab, setTab] = useState<"exports" | "entries" | "plan">("exports");
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState<AccountingSettings>(data.settings.accounting);
  const [saved, setSaved] = useState(false);
  const end = new Date(Date.parse(to) + 864e5).toISOString().slice(0, 10);
  const entries = useMemo(() => journalEntries(data, from, end), [data, from, end]);
  const unbalanced = entries.filter((e) => !isBalanced(e));
  const sales = entries.filter((e) => e.kind === "sale" || e.kind === "credit");
  const purchases = entries.filter((e) => e.kind === "purchase" || e.kind === "expense");
  const retentions = retentionsToTransfer(data, from, end);
  const name = (k: string, ext: string) => `biltov-${k}-${from}_${to}.${ext}`;
  const total = (list: typeof entries, acc: string, side: "debit" | "credit") => round2(list.flatMap((e) => e.lines).filter((l) => l.account === acc).reduce((s, l) => s + l[side], 0));

  const ublZip = async () => {
    const docs = data.docs.filter((x) => (x.type === "invoice" || x.type === "credit") && x.lockedAt && x.issueDate >= from && x.issueDate < end);
    const files = docs.flatMap((x) => {
      const c = data.clients.find((cl) => cl.id === x.clientId);
      if (!c) return [];
      return [{ name: `${x.number}.xml`, data: buildUbl(x, data, c, x.sourceId ? data.docs.find((s) => s.id === x.sourceId) : null).xml }];
    });
    downloadBlob(await zipBlob(files), name("ubl", "zip"));
  };

  const winbooks = async () => {
    downloadBlob(await zipBlob([{ name: "ACT.DBF", data: winbooksAct(entries, data.settings.accounting) }, { name: "CSF.DBF", data: winbooksCsf(data) }]), name("winbooks", "zip"));
  };

  const csv = () => {
    const c = entriesCsv(entries);
    downloadBlob(new Blob([toCsv(c.headers, c.rows)], { type: "text/csv;charset=utf-8" }), name("ecritures", "csv"));
  };

  const excel = async () => {
    const c = entriesCsv(entries);
    downloadBlob(await workbookBlob([{ name: "Écritures", headers: c.headers, rows: c.rows }]), name("ecritures", "xlsx"));
  };

  return (
    <div>
      <PageHeader title={t("Comptabilité")} subtitle={t("Écritures PCMN, exports WinBooks, UBL et CSV pour votre comptable")} />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field label={t("Du")} className="w-48">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("Au")} className="w-48">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="min-w-0 max-w-full pb-1">
          <SubTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "exports", label: t("Exports") },
              { id: "entries", label: t("Écritures"), count: entries.length },
              { id: "plan", label: t("Plan comptable") },
            ]}
          />
        </div>
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label={t("Ventes HTVA")} value={f.money0(round2(total(sales, data.settings.accounting.sales, "credit") - total(sales, data.settings.accounting.sales, "debit")))} sub={t("{n} pièce(s)", { n: sales.length })} />
        <Stat label={t("TVA due")} value={f.money0(round2(total(entries, data.settings.accounting.vatDue, "credit") - total(entries, data.settings.accounting.vatDue, "debit")))} />
        <Stat label={t("Achats et frais")} value={f.money0(round2(purchases.flatMap((e) => e.lines).filter((l) => l.account === data.settings.accounting.suppliers).reduce((s, l) => s + l.credit, 0)))} sub={t("{n} pièce(s)", { n: purchases.length })} />
        <Stat label={t("Écritures équilibrées")} value={unbalanced.length ? `${entries.length - unbalanced.length}/${entries.length}` : "✓"} tone={unbalanced.length ? "danger" : "ok"} />
      </div>

      {tab === "exports" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card space-y-3 p-5">
              <p className="flex items-center gap-2 font-semibold text-white">
                <FileArchive className="h-4 w-4 text-cyan" /> WinBooks
              </p>
              <p className="text-xs text-slate-400">{t("Fichiers ACT.DBF (écritures) et CSF.DBF (clients et fournisseurs).")}</p>
              <button onClick={winbooks} disabled={!entries.length} className="btn-primary w-full !py-2 text-sm disabled:opacity-40">
                <Download className="h-4 w-4" /> ZIP
              </button>
            </div>
            <div className="card space-y-3 p-5">
              <p className="flex items-center gap-2 font-semibold text-white">
                <FileCode2 className="h-4 w-4 text-cyan" /> UBL / Peppol BIS 3.0
              </p>
              <p className="text-xs text-slate-400">{t("Une facture UBL par document de vente : Yuki, Pennylane, Odoo, BOB50, Exact…")}</p>
              <button onClick={ublZip} disabled={!sales.length} className="btn-primary w-full !py-2 text-sm disabled:opacity-40">
                <Download className="h-4 w-4" /> ZIP
              </button>
            </div>
            <div className="card space-y-3 p-5">
              <p className="flex items-center gap-2 font-semibold text-white">
                <FileSpreadsheet className="h-4 w-4 text-cyan" /> {t("Écritures (PCMN)")}
              </p>
              <p className="text-xs text-slate-400">{t("Une ligne par imputation : journal, pièce, compte, débit, crédit, code TVA.")}</p>
              <div className="flex gap-2">
                <button onClick={csv} disabled={!entries.length} className="btn-ghost flex-1 !py-2 text-sm disabled:opacity-40">
                  CSV
                </button>
                <button onClick={excel} disabled={!entries.length} className="btn-ghost flex-1 !py-2 text-sm disabled:opacity-40">
                  Excel
                </button>
              </div>
            </div>
            <div className="card space-y-3 p-5">
              <p className="flex items-center gap-2 font-semibold text-white">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> {t("Retenues 30bis à verser")}
              </p>
              {retentions.length ? (
                <ul className="space-y-1 text-xs text-slate-300">
                  {retentions.map((r) => (
                    <li key={r.purchase.id}>
                      {r.purchase.number} : ONSS {f.money(r.onss)} · SPF {f.money(r.tax)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">{t("Aucune retenue sur la période.")}</p>
              )}
            </div>
          </div>
          <Notice tone="warn">{t("Comptes PCMN et format WinBooks proposés par défaut : faites un import test avec votre comptable et adaptez le plan comptable si besoin.")}</Notice>
        </div>
      )}

      {tab === "entries" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">{t("Journal")}</th>
                <th className="p-3">{t("Pièce")}</th>
                <th className="p-3">{t("Date")}</th>
                <th className="p-3">{t("Compte")}</th>
                <th className="p-3">{t("Libellé")}</th>
                <th className="p-3 text-right">{t("Débit")}</th>
                <th className="p-3 text-right">{t("Crédit")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 300).flatMap((e) =>
                e.lines.map((l, i) => (
                  <tr key={`${e.sourceId}-${i}`} className={cn(i === 0 && "border-t border-white/10", !isBalanced(e) && "bg-rose-500/10")}>
                    <td className="px-3 py-1.5 text-slate-500">{i === 0 ? e.journal : ""}</td>
                    <td className="px-3 py-1.5 text-slate-200">{i === 0 ? e.number : ""}</td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-500">{i === 0 ? f.date(e.date) : ""}</td>
                    <td className="px-3 py-1.5 font-mono text-cyan">{l.account}</td>
                    <td className="px-3 py-1.5 text-slate-300">
                      {l.label}
                      {i === 0 && e.partner.code ? <span className="text-slate-500"> · {e.partner.code}</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.debit ? f.money(l.debit) : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{l.credit ? f.money(l.credit) : ""}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
          {!entries.length && <p className="p-6 text-sm text-slate-500">{t("Aucune pièce sur cette période.")}</p>}
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ACCOUNT_FIELDS.map((a) => (
              <Field key={a.key} label={t(a.label)}>
                <input className={cn(inputClass, "font-mono")} value={plan[a.key]} onChange={(e) => setPlan({ ...plan, [a.key]: e.target.value.toUpperCase().slice(0, 10) })} />
              </Field>
            ))}
          </div>
          <button
            onClick={() => {
              update((d) => ({ ...d, settings: { ...d.settings, accounting: plan } }));
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="btn-primary text-sm"
          >
            {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />} {saved ? t("Enregistré") : t("Enregistrer")}
          </button>
        </div>
      )}
    </div>
  );
}
