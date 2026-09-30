"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, Plus, Receipt, ScanLine, Trash2 } from "lucide-react";
import { useAppData, compressImage } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { todayIso, uid } from "@/lib/app/defaults";
import { round2 } from "@/lib/app/money";
import { readReceipt } from "@/lib/app/ocr";
import type { Expense } from "@/lib/app/types";
import { Empty, Field, Modal, Notice, Toggle, inputClass } from "./ui";

export const expenseHt = (e: Expense) => round2(e.amountTTC / (1 + e.vat / 100));

/** Ticket / note de frais : photo lue par OCR (fournisseur, date, total TVAC). */
export function ExpenseForm({ jobId, expense, onClose }: { jobId: string | null; expense: Expense | null; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, putBlob } = useAppData();
  const [e, setE] = useState<Expense>(expense ?? { id: uid(), jobId, memberId: null, date: todayIso(), supplier: "", label: "", amountTTC: 0, vat: 21, receiptId: null, reimbursable: false, status: "draft" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setE((x) => ({ ...x, [k]: v }));
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = async (fl: File | undefined) => {
    if (!fl) return;
    setFile(fl);
    setPreview(URL.createObjectURL(fl));
    setScan(0);
    setMsg(null);
    try {
      const g = await readReceipt(fl, (p) => setScan(p));
      setE((x) => ({ ...x, supplier: x.supplier || g.supplier, date: g.date || x.date, amountTTC: g.total ?? x.amountTTC }));
      setMsg(g.total ? t("Montant lu : {m} — vérifiez avant d'enregistrer.", { m: f.money(g.total) }) : t("Montant non trouvé sur le ticket : saisissez-le."));
    } catch {
      setMsg(t("Lecture automatique indisponible : saisissez le montant."));
    } finally {
      setScan(null);
    }
  };

  return (
    <Modal
      title={expense ? t("Modifier la dépense") : t("Nouvelle dépense / note de frais")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button
            disabled={!e.label.trim() || e.amountTTC <= 0 || scan !== null}
            onClick={async () => {
              let saved = e;
              if (file) {
                const id = e.receiptId ?? uid();
                await putBlob(`receipt:${id}`, (await compressImage(file, 1600, 0.8)).blob);
                saved = { ...e, receiptId: id };
              }
              upsert("expenses", saved);
              onClose();
            }}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 hover:border-cyan/60">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ScanLine className="h-6 w-6 text-cyan" />}</span>
          <span>
            <span className="block text-sm font-semibold text-slate-200">{t("Photographier le ticket ou la facture")}</span>
            <span className="block text-xs text-slate-500">{t("Lecture du fournisseur, de la date et du total TVAC (dans le navigateur).")}</span>
          </span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(ev) => pick(ev.target.files?.[0])} />
        </label>
        {scan !== null && (
          <p className="flex items-center gap-2 text-sm text-cyan">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("Lecture du ticket…")} {Math.round(scan * 100)} %
          </p>
        )}
        {msg && <Notice>{msg}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("Désignation")} *`}>
            <input className={inputClass} value={e.label} onChange={(ev) => set("label", ev.target.value)} />
          </Field>
          <Field label={t("Fournisseur")}>
            <input className={inputClass} value={e.supplier} onChange={(ev) => set("supplier", ev.target.value)} />
          </Field>
          <Field label={t("Date")}>
            <input type="date" className={inputClass} value={e.date} onChange={(ev) => set("date", ev.target.value)} />
          </Field>
          <Field label={`${t("Montant TVAC")} *`}>
            <input type="number" step="0.01" className={inputClass} value={e.amountTTC || ""} onChange={(ev) => set("amountTTC", ev.target.valueAsNumber || 0)} />
          </Field>
          <Field label={t("TVA")} hint={`${f.money(expenseHt(e))} HTVA`}>
            <select className={inputClass} value={e.vat} onChange={(ev) => set("vat", Number(ev.target.value))}>
              {[21, 12, 6, 0].map((r) => (
                <option key={r} value={r}>
                  {r} %
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Chantier")}>
            <select className={inputClass} value={e.jobId ?? ""} onChange={(ev) => set("jobId", ev.target.value || null)}>
              <option value="">—</option>
              {data.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Payé par")}>
            <select className={inputClass} value={e.memberId ?? ""} onChange={(ev) => set("memberId", ev.target.value || null)}>
              <option value="">{t("L'entreprise")}</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="pt-6">
            <Toggle checked={e.reimbursable} onChange={(v) => set("reimbursable", v)} label={t("À rembourser (note de frais)")} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ReceiptThumb({ id }: { id: string }) {
  const { blobUrl } = useAppData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void blobUrl(`receipt:${id}`).then(setUrl);
  }, [id, blobUrl]);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="block h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
      <img src={url} alt="" className="h-full w-full object-cover" />
    </a>
  ) : (
    <span className="h-10 w-10 shrink-0 rounded-lg bg-white/5" />
  );
}

export function ExpensesList({ jobId }: { jobId: string | null }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, remove } = useAppData();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const list = data.expenses.filter((e) => jobId === null || e.jobId === jobId).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-3">
        <h4 className="font-display text-base font-bold text-white">{t("Tickets et dépenses")}</h4>
        <button onClick={() => setEditing("new")} className="btn-primary !py-2 text-sm">
          <Plus className="h-4 w-4" /> {t("Ajouter / scanner")}
        </button>
      </div>
      {!list.length ? (
        <Empty icon={Receipt} text={t("Scannez vos tickets de négoce : Biltov lit le montant et l'impute au chantier.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              {e.receiptId ? <ReceiptThumb id={e.receiptId} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5"><Receipt className="h-4 w-4 text-slate-500" /></span>}
              <button onClick={() => setEditing(e)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-slate-100">{e.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {e.supplier || "—"} · {f.date(e.date)}
                  {e.reimbursable ? ` · ${t("note de frais")} (${t(e.status)})` : ""}
                </p>
              </button>
              <div className="text-right text-sm tabular-nums">
                <p className="font-semibold text-white">{f.money(expenseHt(e))} HTVA</p>
                <p className="text-xs text-slate-500">{f.money(e.amountTTC)} TVAC</p>
              </div>
              <button onClick={() => window.confirm(t("Supprimer cette dépense ?")) && remove("expenses", e.id)} className="rounded-lg p-2 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>{editing && <ExpenseForm jobId={jobId} expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
