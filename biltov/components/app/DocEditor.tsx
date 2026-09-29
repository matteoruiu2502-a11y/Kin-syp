"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BadgeEuro, Ban, Eye, FileCheck2, FileMinus2, FilePlus2, Lock, PenLine, Plus, Receipt, Send, Trash2, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { usePdf } from "@/lib/app/usePdf";
import { uid } from "@/lib/app/defaults";
import { computeTotals, eur, lineTotal } from "@/lib/app/money";
import { fmtDate, missingCompanyFields } from "@/lib/app/legal";
import { DOC_STATUS, UNITS } from "@/lib/app/labels";
import { reminderSchedule } from "@/lib/app/reminders";
import { docTitle } from "@/lib/app/pdf";
import { VAT_RATES, type Doc, type Line, type VatRate } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { Field, Modal, Notice, inputClass } from "./ui";
import { VoiceInput } from "./VoiceInput";
import { SendDialog } from "./SendDialog";
import { SignDialog } from "./SignDialog";
import { PayDialog } from "./PayDialog";

const cell = "rounded-lg border border-white/10 bg-ink/70 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan disabled:border-transparent disabled:bg-transparent";

/** Éditeur de devis / facture / avoir : lignes, dictée, TVA, signature, envoi, émission, paiement. */
export function DocEditor({ docId, onClose, onOpen }: { docId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const app = useAppData();
  const { data } = app;
  const { preview } = usePdf();
  const doc = data.docs.find((d) => d.id === docId);
  const [dialog, setDialog] = useState<null | "send" | "sign" | "pay" | { reminder: number }>(null);
  const [menu, setMenu] = useState(false);
  const job = doc && data.jobs.find((j) => j.id === doc.jobId);
  if (!doc || !job) return null;
  const source = doc.sourceId ? data.docs.find((d) => d.id === doc.sourceId) : null;
  const locked = !!doc.lockedAt || (doc.type === "quote" && doc.status === "accepted");
  const vatApplies = data.company.vatMode === "normal" && !job.reverseCharge;
  const totals = computeTotals(doc, vatApplies);
  const missing = missingCompanyFields(data.company);
  const catalogue = t.trades.list.find((x) => x.id === job.trade)?.lines ?? [];
  const reducedMisuse = vatApplies && !job.reducedVatEligible && doc.lines.some((l) => l.vat === 10 || l.vat === 5.5);

  const update = (patch: Partial<Doc>) => app.saveDoc({ ...doc, ...patch });
  const setLine = (id: string, patch: Partial<Line>) => update({ lines: doc.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLines = (lines: Omit<Line, "id" | "vat">[]) => update({ lines: [...doc.lines, ...lines.map((l) => ({ ...l, id: uid(), vat: (job.reducedVatEligible ? data.settings.defaultVat : 20) as VatRate }))] });

  const canSend = doc.lines.length > 0 && missing.length === 0 && (doc.type === "quote" || !!doc.lockedAt);
  const title = `${docTitle(doc).charAt(0)}${docTitle(doc).slice(1).toLowerCase()} ${doc.number ?? "(brouillon)"}`;

  const toInvoice = (kind: Doc["kind"]) => {
    setMenu(false);
    onOpen(app.quoteToInvoice(doc.id, kind).id);
  };

  const issue = () => {
    const label = doc.type === "credit" ? "cet avoir" : "cette facture";
    if (!window.confirm(`Émettre ${label} ? Un numéro définitif lui sera attribué et elle ne pourra plus être modifiée (obligation légale). Toute correction passera par un avoir.`)) return;
    app.issueInvoice(doc.id);
  };

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        {!doc.lockedAt && !(doc.type === "quote" && doc.status === "accepted") && (
          <button
            onClick={() => {
              if (window.confirm("Supprimer ce brouillon ?")) {
                app.removeDoc(doc.id);
                onClose();
              }
            }}
            className="btn-ghost !px-3 text-sm text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => preview(doc)} disabled={!doc.lines.length} className="btn-ghost text-sm disabled:opacity-40">
          <Eye className="h-4 w-4" /> Aperçu PDF
        </button>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {doc.type === "quote" && doc.status !== "accepted" && doc.status !== "refused" && (
          <>
            <button onClick={() => update({ status: "refused" })} className="btn-ghost text-sm" disabled={!doc.lines.length}>
              <XCircle className="h-4 w-4" /> Refusé
            </button>
            <button onClick={() => setDialog("sign")} disabled={!canSend} className="btn-ghost text-sm disabled:opacity-40">
              <PenLine className="h-4 w-4" /> Faire signer
            </button>
          </>
        )}
        {doc.type === "quote" && doc.status === "accepted" && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="btn-ghost text-sm">
              <Receipt className="h-4 w-4" /> Facturer
            </button>
            {menu && (
              <div className="card absolute bottom-full right-0 z-10 mb-2 w-72 p-2 text-sm">
                {doc.depositPercent > 0 && (
                  <button onClick={() => toInvoice("deposit")} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">
                    Facture d&apos;acompte ({doc.depositPercent} % = {eur(totals.deposit)})
                  </button>
                )}
                <button onClick={() => toInvoice("balance")} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">
                  Facture de solde (déduit les acomptes)
                </button>
                <button onClick={() => toInvoice("full")} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">
                  Facture complète
                </button>
              </div>
            )}
          </div>
        )}
        {doc.type !== "quote" && !doc.lockedAt && (
          <button onClick={issue} disabled={!doc.lines.length || missing.length > 0} className="btn-primary text-sm disabled:opacity-40">
            <FileCheck2 className="h-4 w-4" /> Émettre {doc.type === "credit" ? "l'avoir" : "la facture"}
          </button>
        )}
        {doc.type === "invoice" && doc.status === "issued" && (
          <>
            <button
              onClick={() => {
                const credit = app.creditNote(doc.id);
                if (credit) onOpen(credit.id);
              }}
              className="btn-ghost text-sm"
            >
              <FileMinus2 className="h-4 w-4" /> Avoir
            </button>
            <button onClick={() => setDialog("pay")} className="btn-ghost text-sm">
              <BadgeEuro className="h-4 w-4 text-emerald" /> Paiement reçu
            </button>
          </>
        )}
        {(doc.type === "quote" || doc.lockedAt) && (
          <button onClick={() => setDialog("send")} disabled={!canSend} className="btn-primary text-sm disabled:opacity-40">
            <Send className="h-4 w-4" /> Envoyer
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Modal title={title} onClose={onClose} wide footer={footer}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <Badge {...DOC_STATUS[doc.status]} />
            <span>
              {job.name} · {job.client}
            </span>
            {source && <span>· d&apos;après {source.number}</span>}
          </div>

          {missing.length > 0 && <Notice tone="warn">Complétez les informations légales de votre entreprise (Paramètres) pour envoyer ou émettre ce document.</Notice>}
          {doc.lockedAt && (
            <Notice>
              <Lock className="mr-1 inline h-4 w-4" /> Document émis le {fmtDate(doc.issueDate)} : il n&apos;est plus modifiable. Pour le corriger, établissez un avoir.
            </Notice>
          )}
          {doc.type === "quote" && doc.status === "accepted" && doc.signature && (
            <Notice tone="ok">
              Signé par {doc.signature.name} le {new Date(doc.signature.at).toLocaleString("fr-FR")}. Transformez-le en facture avec « Facturer ».
            </Notice>
          )}
          {reducedMisuse && <Notice tone="warn">Taux réduit utilisé alors que le chantier n&apos;est pas marqué « logement de plus de 2 ans » : vérifiez l&apos;éligibilité (Infos du chantier).</Notice>}

          {/* Dates et conditions */}
          <div className="grid gap-4 sm:grid-cols-3">
            {doc.type === "quote" ? (
              <>
                <Field label="Date du devis">
                  <input type="date" className={inputClass} value={doc.issueDate} disabled={locked} onChange={(e) => update({ issueDate: e.target.value })} />
                </Field>
                <Field label="Valable jusqu'au">
                  <input type="date" className={inputClass} value={doc.validUntil} disabled={locked} onChange={(e) => update({ validUntil: e.target.value })} />
                </Field>
                <Field label="Acompte à la signature (%)">
                  <input type="number" min={0} max={100} className={inputClass} value={doc.depositPercent} disabled={locked} onChange={(e) => update({ depositPercent: Math.min(100, Math.max(0, e.target.valueAsNumber || 0)) })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Date d'émission" hint={!doc.lockedAt ? "Fixée à l'émission" : undefined}>
                  <input type="date" className={inputClass} value={doc.issueDate} disabled />
                </Field>
                <Field label="Date d'exécution des travaux">
                  <input type="date" className={inputClass} value={doc.workDate} disabled={locked} onChange={(e) => update({ workDate: e.target.value })} />
                </Field>
                {doc.type === "invoice" && (
                  <Field label="Échéance de paiement">
                    <input type="date" className={inputClass} value={doc.dueDate} disabled={locked} onChange={(e) => update({ dueDate: e.target.value })} />
                  </Field>
                )}
              </>
            )}
          </div>

          {/* Dictée */}
          {!locked && (
            <VoiceInput
              compact
              onResult={(r) => {
                addLines(r.lines.map((l) => ({ label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.price })));
              }}
            />
          )}

          {/* Lignes */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Désignation</th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">Qté</th>
                  <th className="w-24 px-2 py-2.5 font-semibold">Unité</th>
                  <th className="w-28 px-2 py-2.5 text-right font-semibold">PU HT</th>
                  {vatApplies && <th className="w-24 px-2 py-2.5 font-semibold">TVA</th>}
                  <th className="w-28 px-3 py-2.5 text-right font-semibold">Total HT</th>
                  {!locked && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l) => (
                  <tr key={l.id} className="border-t border-white/5 align-top">
                    <td className="px-2 py-2">
                      <textarea rows={1} className={cn(cell, "w-full resize-y")} value={l.label} disabled={locked} onChange={(e) => setLine(l.id, { label: e.target.value })} />
                    </td>
                    <td className="px-1 py-2">
                      <input type="number" step="any" className={cn(cell, "w-full text-right")} value={Number.isFinite(l.qty) ? l.qty : ""} disabled={locked} onChange={(e) => setLine(l.id, { qty: e.target.valueAsNumber })} />
                    </td>
                    <td className="px-1 py-2">
                      <select className={cn(cell, "w-full")} value={l.unit} disabled={locked} onChange={(e) => setLine(l.id, { unit: e.target.value })}>
                        {[...new Set([...UNITS, l.unit])].map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <input type="number" step="0.01" className={cn(cell, "w-full text-right")} value={Number.isFinite(l.unitPrice) ? l.unitPrice : ""} disabled={locked} onChange={(e) => setLine(l.id, { unitPrice: e.target.valueAsNumber })} />
                    </td>
                    {vatApplies && (
                      <td className="px-1 py-2">
                        <select className={cn(cell, "w-full")} value={l.vat} disabled={locked} onChange={(e) => setLine(l.id, { vat: Number(e.target.value) as VatRate })}>
                          {VAT_RATES.map((r) => (
                            <option key={r} value={r}>
                              {r.toLocaleString("fr-FR")} %
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-white">{eur(lineTotal({ ...l, qty: l.qty || 0, unitPrice: l.unitPrice || 0 }))}</td>
                    {!locked && (
                      <td className="py-2 pr-2">
                        <button onClick={() => update({ lines: doc.lines.filter((x) => x.id !== l.id) })} className="rounded-lg p-2 text-slate-500 hover:text-rose-400" aria-label="Supprimer la ligne">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!doc.lines.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                      Dictez vos lignes ou ajoutez-les à la main.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!locked && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addLines([{ label: "", qty: 1, unit: "u", unitPrice: 0 }])} className="btn-ghost !py-2 text-sm">
                <Plus className="h-4 w-4" /> Ajouter une ligne
              </button>
              {catalogue.length > 0 && (
                <select
                  className={cn(inputClass, "!w-auto max-w-full !py-2")}
                  value=""
                  onChange={(e) => {
                    const item = catalogue[Number(e.target.value)];
                    if (item) addLines([{ label: item.label, qty: item.qty, unit: item.unit, unitPrice: item.price }]);
                  }}
                  aria-label="Ajouter depuis le catalogue"
                >
                  <option value="">+ Catalogue {t.trades.list.find((x) => x.id === job.trade)?.name.toLowerCase()}</option>
                  {catalogue.map((c, i) => (
                    <option key={c.label} value={i}>
                      {c.label} — {c.price} €/{c.unit}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Field label="Texte affiché sur le document (facultatif)">
              <textarea rows={4} className={cn(inputClass, "resize-y")} value={doc.notes} disabled={locked} onChange={(e) => update({ notes: e.target.value })} placeholder="Précisions sur les travaux, fournitures, conditions particulières…" />
            </Field>
            <div className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm tabular-nums">
              <Row k="Total HT" v={eur(totals.ht)} />
              {vatApplies ? totals.vatByRate.map((v) => <Row key={v.rate} k={`TVA ${v.rate.toLocaleString("fr-FR")} %`} v={eur(v.vat)} />) : <Row k={data.company.vatMode === "franchise" ? "TVA non applicable" : "TVA autoliquidée"} v={eur(0)} />}
              <Row k="Total TTC" v={eur(totals.ttc)} strong />
              {doc.type === "quote" && doc.depositPercent > 0 && <Row k={`Acompte ${doc.depositPercent} %`} v={eur(totals.deposit)} />}
              {doc.type === "invoice" && doc.paidBefore > 0 && (
                <>
                  <Row k="Acomptes réglés" v={`- ${eur(doc.paidBefore)}`} />
                  <Row k="Net à payer" v={eur(totals.due)} strong />
                </>
              )}
            </div>
          </div>

          {doc.type === "invoice" && doc.status === "issued" && (
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Relances automatiques (après l&apos;échéance du {fmtDate(doc.dueDate)})</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {reminderSchedule(doc).map((s, i) => (
                  <button key={s.day} onClick={() => setDialog({ reminder: i })} className={cn("rounded-xl border p-3 text-left text-sm transition-colors hover:border-cyan/50", s.sent ? "border-emerald/30 bg-emerald/5" : "border-white/10")}>
                    <span className="block font-semibold text-white">
                      J+{s.day} · {s.title}
                    </span>
                    <span className="text-xs text-slate-400">{s.sent ? "Envoyée ✓" : `Prévue le ${fmtDate(s.date)}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {doc.status === "paid" && (
            <Notice tone="ok">
              Payée le {fmtDate(doc.paidAt ?? "")} ({doc.paymentMethod}). Relances arrêtées.
            </Notice>
          )}
          {doc.status === "cancelled" && (
            <Notice tone="warn">
              <Ban className="mr-1 inline h-4 w-4" /> Facture annulée par un avoir.
            </Notice>
          )}
          {doc.type === "quote" && doc.status === "draft" && doc.lines.length > 0 && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <FilePlus2 className="h-3.5 w-3.5" /> Enregistré automatiquement. Envoyez-le ou faites-le signer sur place.
            </p>
          )}
        </div>
      </Modal>

      <AnimatePresence>
        {dialog === "send" && <SendDialog doc={doc} onClose={() => setDialog(null)} />}
        {dialog && typeof dialog === "object" && <SendDialog doc={doc} reminderStep={dialog.reminder} onClose={() => setDialog(null)} />}
        {dialog === "sign" && (
          <SignDialog
            doc={doc}
            job={job}
            onClose={() => setDialog(null)}
            onSigned={(signature) => {
              update({ signature, status: "accepted" });
              setDialog(null);
            }}
          />
        )}
        {dialog === "pay" && (
          <PayDialog
            doc={doc}
            onClose={() => setDialog(null)}
            onPaid={(date, method) => {
              app.markPaid(doc.id, date, method);
              setDialog(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "border-t border-white/10 pt-2 font-display text-lg font-bold text-white" : "text-slate-400")}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
