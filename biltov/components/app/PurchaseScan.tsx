"use client";

import { useEffect, useState } from "react";
import { Loader2, ScanLine, Trash2 } from "lucide-react";
import { useAppData, compressImage } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, todayIso, uid } from "@/lib/app/defaults";
import { recognizeText } from "@/lib/app/ocr";
import { guessInvoice, type InvoiceGuess, type VatRow } from "@/lib/app/invoiceOcr";
import { formatBce } from "@/lib/tax/belgium";
import { round2 } from "@/lib/app/money";
import { emptyAddress, type Purchase, type PurchaseType, type Supplier } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Field, Modal, Notice, cellClass, inputClass } from "./ui";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Scan d'une facture fournisseur ou d'un bon de livraison : lecture, vérification, création de la pièce d'achat. */
export function PurchaseScan({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Purchase) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, putBlob } = useAppData();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [g, setG] = useState<InvoiceGuess | null>(null);
  const [type, setType] = useState<PurchaseType>("invoice");
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [jobId, setJobId] = useState("");
  const [orderId, setOrderId] = useState("");
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const read = async (fl: File | undefined) => {
    if (!fl) return;
    if (!fl.type.startsWith("image/")) return setError(t("Prenez une photo ou une capture d'écran de la facture (image). Les factures PDF / Peppol seront lues directement avec le serveur."));
    setError(null);
    setFile(fl);
    setPreview(URL.createObjectURL(fl));
    setProgress(0);
    try {
      const guess = guessInvoice(await recognizeText(fl, setProgress));
      setG(guess);
      setType(guess.kind);
      const bce = guess.bce.replace(/\D/g, "");
      const s = data.suppliers.find((x) => (bce && x.bce.replace(/\D/g, "") === bce) || (guess.iban && x.iban?.replace(/\s/g, "") === guess.iban.replace(/\s/g, ""))) ?? data.suppliers.find((x) => norm(x.name).length > 2 && norm(guess.supplier).includes(norm(x.name)));
      setSupplierId(s?.id ?? "");
      setNewSupplier(s ? "" : guess.supplier);
    } catch {
      setError(t("Lecture automatique indisponible : saisissez les montants."));
      setG(guessInvoice(""));
    } finally {
      setProgress(null);
    }
  };

  const setRow = (i: number, patch: Partial<VatRow>) => g && setG({ ...g, vatRows: g.vatRows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const htva = round2(g?.vatRows.reduce((s, r) => s + r.base, 0) ?? 0);
  const vat = round2(g?.vatRows.reduce((s, r) => s + (r.base * r.rate) / 100, 0) ?? 0);
  const orders = data.purchases.filter((p) => p.type === "order" && p.supplierId === supplierId && p.status !== "verified");
  const gap = g?.totalTvac ? round2(htva + vat - g.totalTvac) : 0;

  const create = async () => {
    if (!g) return;
    let sid = supplierId;
    const extra: Partial<Supplier> = {};
    let supplierToAdd: Supplier | null = null;
    if (!sid) {
      sid = uid();
      supplierToAdd = { id: sid, kind: "supplier", name: newSupplier || g.supplier || t("Fournisseur"), bce: g.bce ? formatBce(g.bce) : "", email: "", phone: "", address: emptyAddress(), trade: "", importMapping: null, notes: "", iban: g.iban, ...extra };
    }
    let fileId: string | null = null;
    if (file) {
      fileId = uid();
      await putBlob(`file:${fileId}`, (await compressImage(file, 2000, 0.85)).blob);
    }
    const order = data.purchases.find((p) => p.id === orderId);
    const lines =
      type === "delivery" && order
        ? order.lines.map((l) => ({ ...l, id: uid() }))
        : g.vatRows.filter((r) => r.base).map((r) => ({ id: uid(), articleId: null, label: `${type === "delivery" ? t("Bon de livraison") : t("Facture")} ${g.number} — ${t("base")} ${r.rate} %`, qty: 1, unitPrice: r.base, vat: r.rate }));
    const p: Purchase = {
      id: uid(),
      type,
      supplierId: sid,
      jobId: jobId || order?.jobId || null,
      number: g.number,
      date: g.date || todayIso(),
      dueDate: g.dueDate || addDays(g.date || todayIso(), 30),
      lines,
      status: type === "delivery" ? "delivered" : "to_pay",
      source: "ocr",
      retention: null,
      paidAt: null,
      fileId,
      orderId: orderId || null,
      iban: g.iban,
      structuredComm: g.structuredComm,
    };
    update((d) => ({
      ...d,
      suppliers: supplierToAdd ? [supplierToAdd, ...d.suppliers] : d.suppliers.map((s) => (s.id === sid && !s.iban && g.iban ? { ...s, iban: g.iban } : s)),
      purchases: [p, ...d.purchases.map((x) => (x.id === orderId && type === "delivery" ? { ...x, status: "delivered" as const } : x))],
    }));
    onCreated(p);
  };

  return (
    <Modal
      wide="xl"
      title={t("Scanner une facture fournisseur ou un bon de livraison")}
      onClose={onClose}
      footer={
        g && (
          <>
            <button onClick={onClose} className="btn-ghost text-sm">
              {t("Annuler")}
            </button>
            <button onClick={create} disabled={!supplierId && !newSupplier.trim()} className="btn-primary text-sm disabled:opacity-40">
              {type === "delivery" ? t("Enregistrer le bon de livraison") : t("Enregistrer la facture")}
            </button>
          </>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center hover:border-cyan/60">
          {preview ? <img src={preview} alt="" className="max-h-[28rem] w-full object-contain" /> : <ScanLine className="h-8 w-8 text-cyan" />}
          {!preview && <span className="px-4 text-sm text-slate-400">{t("Photographiez la facture ou le bon de livraison")}</span>}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
        </label>
        <div className="space-y-4">
          {progress !== null && (
            <p className="flex items-center gap-2 text-sm text-cyan">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("Lecture du document…")} {Math.round(progress * 100)} %
            </p>
          )}
          {error && <Notice tone="warn">{error}</Notice>}
          {!g && progress === null && <Notice>{t("Biltov lit le fournisseur, le numéro, les dates, les bases HTVA par taux (0, 6, 12, 21 %), le total TVAC, l'IBAN et la communication structurée. Vous vérifiez avant d'enregistrer.")}</Notice>}
          {g && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("Type")}>
                  <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as PurchaseType)}>
                    <option value="invoice">{t("Facture fournisseur")}</option>
                    <option value="delivery">{t("Bon de livraison")}</option>
                  </select>
                </Field>
                <Field label={t("Fournisseur")} hint={g.bce ? `BCE ${formatBce(g.bce)}` : undefined}>
                  <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">{t("Nouveau fournisseur…")}</option>
                    {data.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!supplierId && (
                  <Field label={t("Nom du nouveau fournisseur")}>
                    <input className={inputClass} value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
                  </Field>
                )}
                <Field label={t("Numéro")}>
                  <input className={inputClass} value={g.number} onChange={(e) => setG({ ...g, number: e.target.value })} />
                </Field>
                <Field label={t("Date")}>
                  <input type="date" className={inputClass} value={g.date} onChange={(e) => setG({ ...g, date: e.target.value })} />
                </Field>
                {type === "invoice" && (
                  <Field label={t("Échéance")}>
                    <input type="date" className={inputClass} value={g.dueDate} onChange={(e) => setG({ ...g, dueDate: e.target.value })} />
                  </Field>
                )}
                <Field label={t("Chantier")}>
                  <select className={inputClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                    <option value="">{t("Stock / frais généraux")}</option>
                    {data.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {orders.length > 0 && (
                  <Field label={t("Bon de commande lié")}>
                    <select className={inputClass} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                      <option value="">—</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.number} — {f.date(o.date)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {type === "invoice" && (
                  <>
                    <Field label="IBAN">
                      <input className={inputClass} value={g.iban} onChange={(e) => setG({ ...g, iban: e.target.value.toUpperCase() })} />
                    </Field>
                    <Field label={t("Communication")}>
                      <input className={inputClass} value={g.structuredComm} onChange={(e) => setG({ ...g, structuredComm: e.target.value })} />
                    </Field>
                  </>
                )}
              </div>

              {!(type === "delivery" && orderId) && (
                <div className="rounded-2xl border border-white/10 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Bases HTVA par taux")}</p>
                  <div className="space-y-2">
                    {g.vatRows.map((r, i) => (
                      <div key={i} className="grid grid-cols-[6rem_1fr_1fr_auto] items-center gap-2 text-sm">
                        <select className={cellClass} value={r.rate} onChange={(e) => setRow(i, { rate: Number(e.target.value) })}>
                          {[21, 12, 6, 0].map((x) => (
                            <option key={x} value={x}>
                              {x} %
                            </option>
                          ))}
                        </select>
                        <input type="number" step="0.01" className={cellClass} value={r.base || ""} onChange={(e) => setRow(i, { base: e.target.valueAsNumber || 0 })} placeholder="HTVA" />
                        <span className="tabular-nums text-slate-400">TVA {f.money((r.base * r.rate) / 100)}</span>
                        <button onClick={() => setG({ ...g, vatRows: g.vatRows.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setG({ ...g, vatRows: [...g.vatRows, { rate: 21, base: 0, vat: 0 }] })} className="btn-ghost !py-1.5 text-xs">
                      + {t("Taux")}
                    </button>
                  </div>
                  <p className="mt-3 flex flex-wrap justify-end gap-4 text-sm text-slate-400">
                    <span>HTVA {f.money(htva)}</span>
                    <span>TVA {f.money(vat)}</span>
                    <span className="font-semibold text-white">TVAC {f.money(htva + vat)}</span>
                    {g.totalTvac !== null && <span className={cn(Math.abs(gap) > 0.05 ? "text-amber-300" : "text-emerald")}>{t("lu sur le document")} : {f.money(g.totalTvac)}</span>}
                  </p>
                </div>
              )}
              {type === "delivery" && orderId && <Notice>{t("Les lignes du bon de commande sont reprises : comparez ensuite les quantités livrées dans le suivi des commandes.")}</Notice>}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
