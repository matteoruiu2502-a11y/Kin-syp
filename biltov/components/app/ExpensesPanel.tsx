"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, Plus, Receipt, ScanLine, Trash2, TrendingUp } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { todayIso, uid } from "@/lib/app/defaults";
import { computeTotals, eur, round2 } from "@/lib/app/money";
import { fmtDate } from "@/lib/app/legal";
import { readReceipt } from "@/lib/app/ocr";
import { VAT_RATES, type Expense, type Job, type VatRate } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Empty, Field, Modal, Notice, inputClass } from "./ui";

const ht = (e: Expense) => round2(e.amountTTC / (1 + e.vat / 100));

/** Chiffre d'affaires HT du chantier : factures émises − avoirs ; à défaut, devis signé. */
export function jobRevenue(jobId: string, docs: ReturnType<typeof useAppData>["data"]["docs"]) {
  const mine = docs.filter((d) => d.jobId === jobId);
  const invoiced = mine.filter((d) => d.type === "invoice" && d.lockedAt && d.kind !== "deposit").reduce((s, d) => s + computeTotals(d).ht, 0);
  const deposits = mine.filter((d) => d.type === "invoice" && d.lockedAt && d.kind === "deposit").reduce((s, d) => s + computeTotals(d).ht, 0);
  const credits = mine.filter((d) => d.type === "credit" && d.lockedAt).reduce((s, d) => s + computeTotals(d).ht, 0);
  // une facture de solde reprend le total : les acomptes ne s'ajoutent pas en plus
  const hasBalance = mine.some((d) => d.type === "invoice" && d.lockedAt && d.kind === "balance");
  const billed = round2(invoiced + (hasBalance ? 0 : deposits) - credits);
  const finalInvoice = mine.some((d) => d.type === "invoice" && d.lockedAt && d.kind !== "deposit");
  const signed = mine.find((d) => d.type === "quote" && d.status === "accepted");
  // Chantier en cours (acompte seulement) : la référence est le devis signé
  if (!finalInvoice && signed) return { amount: computeTotals(signed).ht, source: "devis signé" as const };
  return { amount: billed, source: "facturé" as const };
}

function ExpenseForm({ jobId, expense, onClose }: { jobId: string; expense: Expense | null; onClose: () => void }) {
  const { saveExpense } = useAppData();
  const [e, setE] = useState<Expense>(expense ?? { id: uid(), jobId, date: todayIso(), supplier: "", label: "", amountTTC: 0, vat: 20, receiptId: null });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<null | number>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setE((x) => ({ ...x, [k]: v }));

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setScan(0);
    setScanMsg(null);
    try {
      const guess = await readReceipt(f, (p) => setScan(p));
      setE((x) => ({ ...x, supplier: x.supplier || guess.supplier, date: guess.date || x.date, amountTTC: guess.total ?? x.amountTTC }));
      setScanMsg(guess.total ? `Montant lu : ${eur(guess.total)} — vérifiez avant d'enregistrer.` : "Montant non trouvé sur le ticket : saisissez-le.");
    } catch {
      setScanMsg("Lecture automatique indisponible (connexion ?) : saisissez le montant.");
    } finally {
      setScan(null);
    }
  };

  const valid = e.label.trim() && e.amountTTC > 0;
  return (
    <Modal
      title={expense ? "Modifier la dépense" : "Nouvelle dépense"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            Annuler
          </button>
          <button
            disabled={!valid || scan !== null}
            onClick={async () => {
              await saveExpense(e, file);
              onClose();
            }}
            className="btn-primary text-sm disabled:opacity-40"
          >
            Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 hover:border-cyan/60">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
            {preview ? <img src={preview} alt="Ticket" className="h-full w-full object-cover" /> : <ScanLine className="h-6 w-6 text-cyan" />}
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-200">Photographier le ticket / la facture fournisseur</span>
            <span className="block text-xs text-slate-500">Biltov lit le fournisseur, la date et le total TTC.</span>
          </span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(ev) => pick(ev.target.files?.[0])} />
        </label>
        {scan !== null && (
          <div className="flex items-center gap-3 text-sm text-cyan">
            <Loader2 className="h-4 w-4 animate-spin" /> Lecture du ticket… {Math.round(scan * 100)} %
          </div>
        )}
        {scanMsg && <Notice>{scanMsg}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Désignation *">
            <input className={inputClass} value={e.label} onChange={(ev) => set("label", ev.target.value)} placeholder="Colle carrelage, croisillons…" />
          </Field>
          <Field label="Fournisseur">
            <input className={inputClass} value={e.supplier} onChange={(ev) => set("supplier", ev.target.value)} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} value={e.date} onChange={(ev) => set("date", ev.target.value)} />
          </Field>
          <Field label="Montant TTC (€) *">
            <input type="number" step="0.01" className={inputClass} value={e.amountTTC || ""} onChange={(ev) => set("amountTTC", ev.target.valueAsNumber || 0)} />
          </Field>
          <Field label="TVA récupérable" hint={`Soit ${eur(ht(e))} HT`}>
            <select className={inputClass} value={e.vat} onChange={(ev) => set("vat", Number(ev.target.value) as VatRate)}>
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r.toLocaleString("fr-FR")} %
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptThumb({ id }: { id: string }) {
  const { blobUrl } = useAppData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    blobUrl(`receipt:${id}`).then(setUrl);
  }, [id, blobUrl]);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="block h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
      <img src={url} alt="Ticket" className="h-full w-full object-cover" />
    </a>
  ) : (
    <span className="h-10 w-10 shrink-0 rounded-lg bg-white/5" />
  );
}

export function ExpensesPanel({ job }: { job: Job }) {
  const { data, removeExpense } = useAppData();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const list = useMemo(() => data.expenses.filter((e) => e.jobId === job.id).sort((a, b) => b.date.localeCompare(a.date)), [data.expenses, job.id]);
  const costs = round2(list.reduce((s, e) => s + ht(e), 0));
  const revenue = jobRevenue(job.id, data.docs);
  const margin = round2(revenue.amount - costs);
  const rate = revenue.amount ? Math.round((margin / revenue.amount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`Chiffre d'affaires HT (${revenue.source})`} value={eur(revenue.amount)} />
        <Stat label="Achats HT" value={`- ${eur(costs)}`} />
        <Stat label="Marge du chantier" value={eur(margin)} sub={revenue.amount ? `${rate} %` : undefined} highlight={margin >= 0} />
      </div>

      <div className="flex justify-between gap-3">
        <h4 className="font-display text-base font-bold text-white">Dépenses &amp; tickets</h4>
        <button onClick={() => setEditing("new")} className="btn-primary !py-2 text-sm">
          <Plus className="h-4 w-4" /> Ajouter / scanner
        </button>
      </div>

      {list.length === 0 ? (
        <Empty icon={Receipt} text="Scannez vos tickets de négoce : Biltov lit le montant et calcule la marge réelle du chantier." />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              {e.receiptId ? <ReceiptThumb id={e.receiptId} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5"><Receipt className="h-4 w-4 text-slate-500" /></span>}
              <button onClick={() => setEditing(e)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-slate-100">{e.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {e.supplier || "—"} · {fmtDate(e.date)}
                </p>
              </button>
              <div className="text-right text-sm tabular-nums">
                <p className="font-semibold text-white">{eur(ht(e))} HT</p>
                <p className="text-xs text-slate-500">{eur(e.amountTTC)} TTC</p>
              </div>
              <button onClick={() => window.confirm("Supprimer cette dépense ?") && removeExpense(e.id)} className="rounded-lg p-2 text-slate-500 hover:text-rose-400" aria-label="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>{editing && <ExpenseForm jobId={job.id} expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", highlight ? "border-emerald/40 bg-emerald/10" : "border-white/10 bg-white/[0.02]")}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn("font-display text-2xl font-bold tabular-nums", highlight ? "text-emerald" : "text-white")}>{value}</p>
      {sub && (
        <p className="flex items-center gap-1 text-xs text-emerald">
          <TrendingUp className="h-3 w-3" /> {sub}
        </p>
      )}
    </div>
  );
}
