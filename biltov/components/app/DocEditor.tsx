"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, BadgeEuro, Ban, Calculator, HardHat, Eye, FileCheck2, FileCode2, FileMinus2, FileSpreadsheet, Flag, GitBranch, Heading, Lock, PenLine, Plus, Receipt, Save, Send, Sparkles, Trash2, Type } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { usePdf } from "@/lib/app/usePdf";
import { newArticle, newLine, todayIso, uid } from "@/lib/app/defaults";
import { computeTotals, countsInTotal, lineTotal, round2 } from "@/lib/app/money";
import { addPayment, applyVat, audit, clientOf, createAmendment, creditNote, duplicateQuote, issueBlockers, issueDoc, jobOf, newQuoteVersion, progressInvoiced, quoteToInvoice, signQuote, toProforma, vatContext } from "@/lib/app/ops";
import { articleToLine, dictationToLines, relatedSuggestions } from "@/lib/app/catalog/dictation";
import { searchArticles, bestMatch } from "@/lib/app/catalog/match";
import { parseNumber, workbookBlob, type FieldDef } from "@/lib/app/catalog/import";
import { CATEGORY, DOC_STATUS, UNITS, VAT_LABEL } from "@/lib/app/labels";
import { reminderState, STEP_LABEL } from "@/lib/app/reminders";
import { buildUbl, checkUbl } from "@/lib/app/peppol/ubl";
import { requiresPeppol } from "@/lib/app/peppol/provider";
import { docTitle } from "@/lib/app/pdf";
import { downloadBlob } from "@/lib/app/send";
import { decideVat, VAT_CODES, type LineCategory, type VatCode } from "@/lib/tax/belgium";
import type { Doc, Lang, Line } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { QuoteVisualPanel } from "./QuoteVisual";
import { ordersFromQuote } from "@/lib/app/orders";
import { OWN, lineMargin, quoteByExecution, withCost, withExecution, withMargin, withPrice } from "@/lib/app/execution";
import { NewSubcontractorDialog } from "./SubcontractorsTab";
import { QuantityCalculator } from "./QuantityCalculator";
import { Badge, Field, Modal, Notice, cellClass, inputClass } from "./ui";
import { VoiceInput } from "./VoiceInput";
import { SendDialog } from "./SendDialog";
import { SignDialog } from "./SignDialog";
import { ImportWizard } from "./ImportWizard";
import { PlanChip } from "./PlanGate";
import { PLANS, planFor } from "@/lib/plans";

const METRE_FIELDS: FieldDef[] = [
  { key: "ref", label: "Poste", type: "text", synonyms: ["poste", "post", "n°", "numero", "code", "ref", "référence"] },
  { key: "label", label: "Désignation", required: true, type: "text", synonyms: ["designation", "désignation", "description", "libelle", "omschrijving", "beschrijving", "bezeichnung"] },
  { key: "qty", label: "Quantité", type: "number", synonyms: ["quantite", "quantité", "qte", "qté", "hoeveelheid", "aantal", "menge", "q"] },
  { key: "unit", label: "Unité", type: "text", synonyms: ["unite", "unité", "u", "eenheid", "einheit"] },
  { key: "price", label: "Prix unitaire", type: "number", synonyms: ["pu", "prix unitaire", "prix", "eenheidsprijs", "prijs", "einheitspreis"] },
];

export function DocEditor({ docId, onClose, onOpen }: { docId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const app = useAppData();
  const { data, run, update } = app;
  const { preview } = usePdf();
  const [dialog, setDialog] = useState<null | "send" | "sign" | "pay" | "situation" | "metre" | "deposit" | { reminder: true }>(null);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const doc = data.docs.find((d) => d.id === docId);
  const job = doc ? jobOf(data, doc.jobId) : undefined;
  const client = doc ? clientOf(data, doc.clientId) : undefined;
  const results = useMemo(() => (search.trim() ? searchArticles(search, data.articles.filter((a) => a.active)).slice(0, 8) : []), [search, data.articles]);
  const docModule = doc?.type === "quote" ? "quotes" : "invoices";
  if (!doc || !job || !app.can(docModule)) return null;

  const priceList = data.settings.priceLists.find((p) => p.id === client?.priceListId);
  const canEditDoc = app.can(docModule, "edit");
  const locked = !canEditDoc || !!doc.lockedAt || (doc.type === "quote" && doc.status === "accepted");
  const totals = computeTotals(doc);
  const ctx = vatContext(data, job, client, doc.issueDate);
  const blockers = issueBlockers(data, doc);
  const suggestions = locked ? [] : relatedSuggestions(doc.lines, data.articles);
  const title = `${docTitle(doc, "fr").charAt(0)}${docTitle(doc, "fr").slice(1).toLowerCase()} ${doc.number ?? t("(brouillon)")}`;
  const source = doc.sourceId ? data.docs.find((d) => d.id === doc.sourceId) : null;
  const reminder = doc.type === "invoice" && doc.lockedAt ? reminderState(data, doc) : null;

  const save = (next: Doc) => update((d) => ({ ...d, docs: d.docs.map((x) => (x.id === next.id ? (x.lockedAt ? x : next) : x)), jobs: next.type === "quote" && !next.isAmendment ? d.jobs.map((j) => (j.id === next.jobId ? { ...j, amount: computeTotals(next).htva } : j)) : d.jobs }));
  const patch = (p: Partial<Doc>) => save({ ...doc, ...p });
  const setLines = (lines: Line[]) => save(applyVat(data, { ...doc, lines }));
  const setLine = (id: string, p: Partial<Line>) => setLines(doc.lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const mapLine = (id: string, fn: (l: Line) => Line) => setLines(doc.lines.map((l) => (l.id === id ? fn(l) : l)));
  // coût, marge et exécutant : visibles par qui peut modifier le devis ou consulter la rentabilité
  const showCost = canEditDoc || app.can("profit");
  // sous-traitance ligne par ligne : réservée au forfait qui l'inclut (sinon grisée, l'existant reste affiché)
  const subLines = app.feature("subcontractLines");
  const subcontractors = data.suppliers.filter((x) => x.kind === "subcontractor");
  const [newSubFor, setNewSubFor] = useState<string | null>(null);
  const addLines = (lines: Line[]) => setLines([...doc.lines, ...lines]);
  const [calc, setCalc] = useState(false);
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...doc.lines];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setLines(arr);
  };

  const exportXlsx = async () =>
    downloadBlob(
      await workbookBlob([
        {
          name: doc.number ?? "Devis",
          headers: [t("Désignation"), t("Quantité"), t("Unité"), t("PU HTVA"), t("Remise %"), t("TVA"), t("Total HTVA")],
          rows: [...doc.lines.map((l) => (l.kind === "item" ? [l.label, l.qty, l.unit, l.unitPrice, l.discountPercent, VAT_LABEL[l.vat], countsInTotal(l) ? lineTotal(l) : 0] : [l.label.toUpperCase()])), [], ["", "", "", "", "", t("Total HTVA"), totals.htva], ["", "", "", "", "", t("TVA"), totals.vat], ["", "", "", "", "", t("Total TVAC"), totals.tvac]],
        },
      ]),
      `${doc.number ?? "devis"}.xlsx`,
    );

  const issue = () => {
    if (!window.confirm(t("Émettre ce document ? Un numéro définitif lui sera attribué et il ne pourra plus être modifié. Toute correction passera par une note de crédit."))) return;
    run((d) => issueDoc(d, doc.id));
  };

  const peppolXml = () => {
    if (!client) return;
    const r = buildUbl(doc, data, client, source);
    const errs = checkUbl(r);
    if (errs.length) window.alert(errs.join("\n"));
    downloadBlob(new Blob([r.xml], { type: "application/xml" }), `${doc.number}.xml`);
  };

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        {canEditDoc && !doc.lockedAt && !(doc.type === "quote" && doc.status === "accepted") && (
          <button
            onClick={() => {
              if (!window.confirm(t("Supprimer ce brouillon ?"))) return;
              update((d) => audit({ ...d, docs: d.docs.filter((x) => x.id !== doc.id) }, "delete", doc.type, doc.id, doc.number ?? ""));
              onClose();
            }}
            className="btn-ghost !px-3 text-sm text-rose-300"
            aria-label={t("Supprimer")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => preview(doc)} className="btn-ghost text-sm">
          <Eye className="h-4 w-4" /> PDF
        </button>
        <button onClick={exportXlsx} className="btn-ghost text-sm">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </button>
        {doc.lockedAt && doc.type !== "quote" && (
          <button onClick={peppolXml} className="btn-ghost text-sm" title={t("Fichier Peppol BIS 3.0 (UBL)")}>
            <FileCode2 className="h-4 w-4" /> UBL
          </button>
        )}
      </div>
      <div className="relative flex flex-wrap justify-end gap-2">
        {canEditDoc && (
        <>
        {doc.type === "quote" && (
          <button onClick={() => setMenu((m) => !m)} className="btn-ghost text-sm">
            <GitBranch className="h-4 w-4" /> {t("Plus")}
          </button>
        )}
        {menu && (
          <div className="card absolute bottom-full right-0 z-10 mb-2 w-80 p-2 text-sm">
            {[
              { label: t("Nouvelle version"), run: () => onOpen(run((d) => newQuoteVersion(d, doc.id)).id) },
              { label: t("Dupliquer"), run: () => onOpen(run((d) => duplicateQuote(d, doc.id)).id) },
              { label: t("Avenant / travaux supplémentaires"), run: () => onOpen(run((d) => createAmendment(d, doc.id)).id) },
              { label: t("Facture pro forma"), run: () => onOpen(run((d) => toProforma(d, doc.id)).id) },
              {
                label: doc.template ? t("Retirer des modèles") : t("Enregistrer comme modèle"),
                run: () => patch({ template: doc.template ? null : window.prompt(t("Nom du modèle"), job.name) || null }),
              },
              ...(doc.status === "refused" || doc.status === "expired" ? [] : [{ label: t("Marquer comme refusé"), run: () => patch({ status: "refused" }) }]),
            ].map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setMenu(false);
                  it.run();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
              >
                {it.label}
              </button>
            ))}
            {doc.status === "accepted" && (
              <>
                <p className="mt-2 px-3 text-xs uppercase tracking-wider text-slate-500">{t("Facturer")}</p>
                {[
                  { label: t("Facture d'acompte…"), run: () => setDialog("deposit") },
                  { label: t("État d'avancement (situation)…"), run: () => setDialog("situation") },
                  ...doc.milestones.filter((m) => !m.invoiced).map((m) => ({ label: `${t("Jalon")} : ${m.label} (${m.percent} %)`, run: () => onOpen(run((d) => quoteToInvoice(d, doc.id, "deposit", { milestoneId: m.id })).id) })),
                  { label: t("Facture finale (déduit acomptes et situations)"), run: () => onOpen(run((d) => quoteToInvoice(d, doc.id, "final")).id) },
                  { label: t("Facture complète"), run: () => onOpen(run((d) => quoteToInvoice(d, doc.id, "full")).id) },
                  {
                    label: t("Commander les fournitures (bons de commande)"),
                    run: () => {
                      const created = run((d) => ordersFromQuote(d, doc.id, d.suppliers.find((x) => x.kind === "supplier")?.id ?? null));
                      window.alert(created.length ? t("{n} bon(s) de commande créé(s) en brouillon dans Achats.", { n: created.length }) : t("Aucune fourniture du catalogue avec un fournisseur dans ce devis."));
                    },
                  },
                ].map((it) => (
                  <button
                    key={it.label}
                    onClick={() => {
                      setMenu(false);
                      it.run();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
                  >
                    {it.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {doc.type === "quote" && doc.status !== "accepted" && (
          <button onClick={() => setDialog("sign")} disabled={!doc.lines.some((l) => l.kind === "item")} className="btn-ghost text-sm disabled:opacity-40">
            <PenLine className="h-4 w-4" /> {t("Faire signer")}
          </button>
        )}
        {doc.type === "quote" && doc.status === "accepted" && (
          <button onClick={() => setMenu(true)} className="btn-ghost text-sm">
            <Receipt className="h-4 w-4" /> {t("Facturer")}
          </button>
        )}
        {(doc.type === "invoice" || doc.type === "credit") && !doc.lockedAt && (
          <button onClick={issue} disabled={blockers.length > 0} className="btn-primary text-sm disabled:opacity-40">
            <FileCheck2 className="h-4 w-4" /> {t("Émettre")}
          </button>
        )}
        {doc.type === "invoice" && doc.lockedAt && doc.status !== "cancelled" && (
          <>
            <button onClick={() => onOpen(run((d) => creditNote(d, doc.id))!.id)} className="btn-ghost text-sm">
              <FileMinus2 className="h-4 w-4" /> {t("Note de crédit")}
            </button>
            {doc.status !== "paid" && (
              <button onClick={() => setDialog("pay")} className="btn-ghost text-sm">
                <BadgeEuro className="h-4 w-4 text-emerald" /> {t("Paiement")}
              </button>
            )}
          </>
        )}
        {(doc.type === "quote" || doc.type === "proforma" || doc.lockedAt) && (
          <button onClick={() => setDialog("send")} disabled={!doc.lines.length || doc.lines.some((l) => l.toPrice)} className="btn-primary text-sm disabled:opacity-40">
            <Send className="h-4 w-4" /> {t("Envoyer")}
          </button>
        )}
        </>
        )}
        {!canEditDoc && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" /> {t("Lecture seule")}</span>}
      </div>
    </div>
  );

  return (
    <>
      <Modal title={title} onClose={onClose} wide="xl" footer={footer}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <Badge label={t(DOC_STATUS[doc.status].label)} style={DOC_STATUS[doc.status].style} />
            {doc.version > 1 && <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">v{doc.version}</span>}
            {doc.isAmendment && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">{t("Avenant")}</span>}
            {doc.template && <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-xs text-cyan">{t("Modèle")} : {doc.template}</span>}
            <span>
              {job.name} · {client?.name}
            </span>
            {source && <span>· {source.number}</span>}
            <label className="ml-auto flex items-center gap-2 text-xs">
              {t("Langue du document")}
              <select className={cn(inputClass, "!w-auto !py-1.5")} value={doc.lang} disabled={!!doc.lockedAt} onChange={(e) => patch({ lang: e.target.value as Lang })}>
                <option value="fr">FR</option>
                <option value="nl">NL</option>
                <option value="de">DE</option>
              </select>
            </label>
          </div>

          {doc.lockedAt && (
            <Notice>
              <Lock className="mr-1 inline h-4 w-4" /> {t("Document émis le {d} : immuable. Toute correction passe par une note de crédit.", { d: f.date(doc.issueDate) })} {doc.structuredComm && <span className="ml-2 font-mono">{doc.structuredComm}</span>}
            </Notice>
          )}
          {(doc.type === "invoice" || doc.type === "credit") && !doc.lockedAt && blockers.length > 0 && (
            <Notice tone="warn">
              {t("Émission bloquée — informations obligatoires manquantes")} : {blockers.map((b) => t(b)).join(" · ")}
            </Notice>
          )}
          {doc.type === "quote" && doc.signature && (
            <Notice tone="ok">
              {t("Signé par {n} le {d}.", { n: doc.signature.name, d: new Date(doc.signature.at).toLocaleString(f.locale) })} {t("Utilisez « Facturer » pour les acomptes, situations et la facture finale.")}
            </Notice>
          )}
          {client && requiresPeppol(client) && (doc.type === "invoice" || doc.type === "credit") && (
            <Notice>
              {t("Client assujetti belge : la facture doit être transmise via Peppol (format UBL).")} {doc.peppol.status !== "none" && `${t("Statut Peppol")} : ${t(({ ready: "à transmettre", sent: "transmise", delivered: "délivrée", error: "erreur" } as Record<string, string>)[doc.peppol.status] ?? doc.peppol.status)}.`}
            </Notice>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            {doc.type === "quote" ? (
              <>
                <Field label={t("Date")}>
                  <input type="date" className={inputClass} value={doc.issueDate} disabled={locked} onChange={(e) => save(applyVat(data, { ...doc, issueDate: e.target.value }))} />
                </Field>
                <Field label={t("Valable jusqu'au")}>
                  <input type="date" className={inputClass} value={doc.validUntil} disabled={locked} onChange={(e) => patch({ validUntil: e.target.value })} />
                </Field>
                <Field label={t("Acompte (%)")}>
                  <input type="number" min={0} max={100} className={inputClass} value={doc.depositPercent} disabled={locked} onChange={(e) => patch({ depositPercent: Math.min(100, Math.max(0, e.target.valueAsNumber || 0)) })} />
                </Field>
                <Field label={t("Mode de facturation")}>
                  <select className={inputClass} value={doc.billingMode} disabled={locked} onChange={(e) => patch({ billingMode: e.target.value as Doc["billingMode"] })}>
                    <option value="forfait">{t("Au forfait")}</option>
                    <option value="regie">{t("En régie (temps + matériaux)")}</option>
                    <option value="jalons">{t("Par jalons")}</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label={t("Date d'émission")}>
                  <input type="date" className={inputClass} value={doc.issueDate} disabled />
                </Field>
                <Field label={t("Date de prestation")}>
                  <input type="date" className={inputClass} value={doc.workDate} disabled={locked} onChange={(e) => patch({ workDate: e.target.value })} />
                </Field>
                <Field label={t("Échéance")}>
                  <input type="date" className={inputClass} value={doc.dueDate} disabled={locked} onChange={(e) => patch({ dueDate: e.target.value })} />
                </Field>
                <Field label={t("Retenue de garantie (%)")}>
                  <input type="number" min={0} max={10} className={inputClass} value={doc.retentionPercent} disabled={locked} onChange={(e) => patch({ retentionPercent: e.target.valueAsNumber || 0 })} />
                </Field>
              </>
            )}
          </div>

          {doc.type === "quote" && doc.billingMode === "jalons" && (
            <div className="space-y-2 rounded-2xl border border-white/10 p-4">
              <p className="text-sm font-semibold text-white">{t("Jalons de facturation")}</p>
              {doc.milestones.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2">
                  <input className={inputClass} value={m.label} disabled={locked} onChange={(e) => patch({ milestones: doc.milestones.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                  <input type="number" className={cn(inputClass, "!w-24")} value={m.percent} disabled={locked} onChange={(e) => patch({ milestones: doc.milestones.map((x, k) => (k === i ? { ...x, percent: e.target.valueAsNumber || 0 } : x)) })} />
                  <span className="text-slate-500">%</span>
                  {m.invoiced && <span className="text-xs text-emerald">{t("facturé")}</span>}
                </div>
              ))}
              {!locked && (
                <button onClick={() => patch({ milestones: [...doc.milestones, { id: uid(), label: t("Jalon {n}", { n: doc.milestones.length + 1 }), percent: 0, invoiced: false }] })} className="btn-ghost !py-1.5 text-xs">
                  <Flag className="h-3.5 w-3.5" /> {t("Ajouter un jalon")}
                </button>
              )}
              <p className="text-xs text-slate-500">{t("Total")} : {doc.milestones.reduce((s, m) => s + m.percent, 0)} %</p>
            </div>
          )}

          {!locked && (
            <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
              <VoiceInput compact onResult={(r) => addLines(dictationToLines(r, data.articles, doc.lang, priceList))} />
              <div className="space-y-2">
                <div className="relative">
                  <input className={inputClass} placeholder={t("Ajouter depuis le catalogue (FR, NL, DE, réf.)…")} value={search} onChange={(e) => setSearch(e.target.value)} />
                  {results.length > 0 && (
                    <ul className="card absolute z-10 mt-1 max-h-72 w-full overflow-y-auto p-1 text-sm">
                      {results.map((a) => (
                        <li key={a.id}>
                          <button
                            onClick={() => {
                              addLines([articleToLine(a, doc.lang, priceList)]);
                              setSearch("");
                            }}
                            className="flex w-full justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                          >
                            <span className="truncate">{a.name[doc.lang] || a.name.fr}</span>
                            <span className="shrink-0 tabular-nums text-slate-400">
                              {f.money(a.salePrice)}/{a.unit}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => addLines([newLine({ vat: "21" })])} className="btn-ghost !py-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> {t("Ligne")}
                  </button>
                  <button onClick={() => setCalc(true)} className="btn-ghost !py-1.5 text-xs">
                    <Calculator className="h-3.5 w-3.5" /> {t("Calculateur")}
                  </button>
                  <button onClick={() => addLines([newLine({ kind: "section", label: t("Nouveau lot") })])} className="btn-ghost !py-1.5 text-xs">
                    <Heading className="h-3.5 w-3.5" /> {t("Lot / section")}
                  </button>
                  <button onClick={() => addLines([newLine({ kind: "text", label: "" })])} className="btn-ghost !py-1.5 text-xs">
                    <Type className="h-3.5 w-3.5" /> {t("Texte")}
                  </button>
                  <button onClick={() => setDialog("metre")} className="btn-ghost !py-1.5 text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> {t("Importer un métré")}
                  </button>
                  {data.docs.some((d) => d.template && d.id !== doc.id) && (
                    <select
                      className={cn(inputClass, "!w-auto !py-1.5 text-xs")}
                      value=""
                      onChange={(e) => {
                        const tpl = data.docs.find((d) => d.id === e.target.value);
                        if (tpl) addLines(tpl.lines.map((l) => ({ ...l, id: uid(), vatOverridden: false })));
                      }}
                    >
                      <option value="">{t("Insérer un modèle…")}</option>
                      {data.docs.filter((d) => d.template && d.id !== doc.id).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.template}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" /> <span className="text-amber-200">{t("Souvent associé")} :</span>
                    {suggestions.map((a) => (
                      <button key={a.id} onClick={() => addLines([articleToLine(a, doc.lang, priceList)])} className="rounded-full border border-amber-400/30 px-2.5 py-1 text-amber-200 hover:bg-amber-400/10">
                        + {a.name[doc.lang] || a.name.fr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className={cn("w-full table-fixed text-sm", locked ? "min-w-[1100px]" : "min-w-[1200px]")}>
              <thead>
                <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
                  {!locked && <th className="w-14" />}
                  <th className="px-3 py-2.5 font-semibold">{t("Désignation")}</th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">{t("Qté")}</th>
                  <th className="w-24 px-2 py-2.5 font-semibold">{t("Unité")}</th>
                  <th className="w-28 px-2 py-2.5 text-right font-semibold">{t("PU HTVA")}</th>
                  <th className="w-20 px-2 py-2.5 text-right font-semibold">{t("Rem. %")}</th>
                  <th className="w-36 px-2 py-2.5 font-semibold">{t("Nature")}</th>
                  <th className="w-36 px-2 py-2.5 font-semibold">{t("TVA")}</th>
                  <th className="w-28 px-3 py-2.5 text-right font-semibold">{t("Total HTVA")}</th>
                  {doc.type === "quote" && <th className="w-16 px-2 py-2.5 text-center font-semibold">{t("Option")}</th>}
                  {!locked && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => {
                  if (l.kind !== "item")
                    return (
                      <tr key={l.id} className="border-t border-white/5 bg-white/[0.02]">
                        {!locked && (
                          <td className="px-1">
                            <Mover i={i} move={move} />
                          </td>
                        )}
                        <td colSpan={doc.type === "quote" ? 9 : 8} className="px-2 py-2">
                          <input className={cn(cellClass, "w-full", l.kind === "section" ? "font-display font-bold uppercase" : "italic text-slate-300")} value={l.label} disabled={locked} placeholder={l.kind === "text" ? t("Texte libre affiché sur le document") : ""} onChange={(e) => setLine(l.id, { label: e.target.value })} />
                        </td>
                        {!locked && (
                          <td className="pr-2">
                            <Del onClick={() => setLines(doc.lines.filter((x) => x.id !== l.id))} />
                          </td>
                        )}
                      </tr>
                    );
                  const decision = decideVat(ctx, l.category);
                  return (
                    <tr key={l.id} className={cn("border-t border-white/5 align-top", l.toPrice && "bg-amber-400/5", l.optional && !l.selected && "opacity-60")}>
                      {!locked && (
                        <td className="px-1 py-2">
                          <Mover i={i} move={move} />
                        </td>
                      )}
                      <td className="px-2 py-2">
                        <textarea rows={1} className={cn(cellClass, "w-full resize-y")} value={l.label} disabled={locked} onChange={(e) => setLine(l.id, { label: e.target.value })} />
                        {showCost && (doc.type === "quote" || l.executedBy || l.costPrice > 0) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
                            <label className="flex items-center gap-1.5">
                              <HardHat className="h-3.5 w-3.5 text-slate-500" />
                              <span className="sr-only">{t("Exécution")}</span>
                              <select
                                aria-label={t("Exécution")}
                                className={cn(cellClass, "!py-1 text-xs", l.executedBy && "border-violet-400/50 text-violet-300")}
                                value={l.executedBy ?? ""}
                                disabled={locked || !subLines}
                                title={subLines ? undefined : t("Disponible dans le forfait {p}.", { p: PLANS[planFor("subcontractLines")].name })}
                                onChange={(e) => (e.target.value === "__new" ? setNewSubFor(l.id) : mapLine(l.id, (x) => withExecution(data, x, e.target.value || null)))}
                              >
                                <option value="">{t("Notre société")}</option>
                                {subcontractors.map((sc) => (
                                  <option key={sc.id} value={sc.id}>
                                    {sc.name}
                                  </option>
                                ))}
                                {l.executedBy && !subcontractors.some((sc) => sc.id === l.executedBy) && <option value={l.executedBy}>{t("Sous-traitant supprimé")}</option>}
                                {!locked && <option value="__new">{t("+ Nouveau sous-traitant…")}</option>}
                              </select>
                              {!subLines && <PlanChip plan={planFor("subcontractLines")} />}
                            </label>
                            <label className="flex items-center gap-1">
                              {t("Coût")}
                              <input type="number" step="0.01" aria-label={t("Coût unitaire")} className={cn(cellClass, "!w-24 !py-1 text-right text-xs")} value={l.costPrice || ""} disabled={locked} onChange={(e) => mapLine(l.id, (x) => withCost(data, x, e.target.valueAsNumber || 0))} />
                            </label>
                            <label className="flex items-center gap-1">
                              {t("Marge")}
                              <input type="number" step="0.5" aria-label={t("Marge %")} className={cn(cellClass, "!w-16 !py-1 text-right text-xs")} value={lineMargin(l) ?? ""} disabled={locked || !l.costPrice} title={!l.costPrice ? t("Indiquez d'abord le coût") : undefined} onChange={(e) => mapLine(l.id, (x) => withMargin(x, e.target.valueAsNumber || 0))} />
                              %
                            </label>
                          </div>
                        )}
                        {l.toPrice && <span className="text-[11px] text-amber-300">{t("À chiffrer : introuvable au catalogue, prix non dicté.")}</span>}
                        {!l.toPrice && l.confidence !== null && l.confidence > 0 && l.confidence < 0.7 && <span className="text-[11px] text-amber-300">{t("Correspondance catalogue incertaine ({p} %) — vérifiez.", { p: Math.round(l.confidence * 100) })}</span>}
                        {l.toPrice && !locked && (
                          <button
                            className="ml-2 text-[11px] text-cyan underline"
                            onClick={() => {
                              const price = parseNumber(window.prompt(t("Prix de vente HTVA pour « {l} »", { l: l.label })) ?? "");
                              if (price === null) return;
                              const art = newArticle({ name: { fr: l.label, nl: doc.lang === "nl" ? l.label : "", de: doc.lang === "de" ? l.label : "" }, unit: l.unit, type: l.unit === "h" ? "labour" : "supply", category: l.category, purchasePrice: price, salePrice: price, salePriceForced: true, marginPercent: 0 });
                              update((d) => ({ ...d, articles: [art, ...d.articles] }));
                              setLine(l.id, { articleId: art.id, unitPrice: price, toPrice: false, confidence: 1 });
                            }}
                          >
                            {t("Créer cet article dans le catalogue")}
                          </button>
                        )}
                      </td>
                      <td className="px-1 py-2">
                        <input type="number" step="any" className={cn(cellClass, "w-full text-right")} value={Number.isFinite(l.qty) ? l.qty : ""} disabled={locked} onChange={(e) => setLine(l.id, { qty: e.target.valueAsNumber })} />
                      </td>
                      <td className="px-1 py-2">
                        <select className={cn(cellClass, "w-full")} value={l.unit} disabled={locked} onChange={(e) => setLine(l.id, { unit: e.target.value })}>
                          {[...new Set([...UNITS, l.unit])].map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-2">
                        <input type="number" step="0.01" className={cn(cellClass, "w-full text-right")} value={Number.isFinite(l.unitPrice) ? l.unitPrice : ""} disabled={locked} onChange={(e) => mapLine(l.id, (x) => withPrice(x, e.target.valueAsNumber))} />
                      </td>
                      <td className="px-1 py-2">
                        <input type="number" step="0.5" className={cn(cellClass, "w-full text-right")} value={l.discountPercent || ""} disabled={locked} onChange={(e) => setLine(l.id, { discountPercent: e.target.valueAsNumber || 0 })} />
                      </td>
                      <td className="px-1 py-2">
                        <select className={cn(cellClass, "w-full")} value={l.category} disabled={locked} onChange={(e) => setLine(l.id, { category: e.target.value as LineCategory })}>
                          {Object.entries(CATEGORY).map(([k, v]) => (
                            <option key={k} value={k}>
                              {t(v)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-2">
                        <select
                          className={cn(cellClass, "w-full", l.vatOverridden && "border-amber-400/60")}
                          value={l.vat}
                          disabled={locked}
                          title={`${t(decision.reason)}${decision.warning ? `\n⚠ ${t(decision.warning)}` : ""}`}
                          onChange={(e) => {
                            const v = e.target.value as VatCode;
                            setLine(l.id, { vat: v, vatOverridden: v !== decision.code });
                            if (v !== decision.code) update((d) => audit(d, "vat_override", doc.type, doc.id, `${l.label}: ${decision.code} → ${v}`));
                          }}
                        >
                          {VAT_CODES.map((c) => (
                            <option key={c} value={c}>
                              {t(VAT_LABEL[c])}
                            </option>
                          ))}
                        </select>
                        {l.vatOverridden ? (
                          <button className="text-[11px] text-amber-300 underline" onClick={() => setLine(l.id, { vatOverridden: false })} disabled={locked}>
                            {t("forcé — revenir au taux conseillé ({c})", { c: t(VAT_LABEL[decision.code]) })}
                          </button>
                        ) : (
                          <span className="block truncate text-[11px] text-slate-500" title={t(decision.reason)}>
                            {t(decision.reason)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">{countsInTotal(l) ? f.money(lineTotal(l)) : "—"}</td>
                      {doc.type === "quote" && (
                        <td className="px-2 py-3 text-center">
                          <input type="checkbox" className="accent-emerald-500" checked={l.optional} disabled={locked} onChange={(e) => setLine(l.id, { optional: e.target.checked, selected: !e.target.checked ? true : l.selected })} title={t("Option proposée au client")} />
                          {l.optional && (
                            <label className="mt-1 block text-[10px] text-slate-400">
                              <input type="checkbox" className="accent-emerald-500" checked={l.selected} onChange={(e) => setLine(l.id, { selected: e.target.checked })} /> {t("retenue")}
                            </label>
                          )}
                        </td>
                      )}
                      {!locked && (
                        <td className="py-2 pr-2">
                          <Del onClick={() => setLines(doc.lines.filter((x) => x.id !== l.id))} />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!doc.lines.length && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-500">
                      {t("Dictez, cherchez dans le catalogue ou importez un métré.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
              <Field label={t("Texte affiché sur le document")}>
                <textarea rows={3} className={cn(inputClass, "resize-y")} value={doc.notes} disabled={locked} onChange={(e) => patch({ notes: e.target.value })} />
              </Field>
              {doc.type === "quote" && <QuoteVisualPanel doc={doc} job={job} locked={locked} onChange={(visual) => patch({ visual })} />}
              {doc.type === "invoice" && doc.lockedAt && (
                <div className="space-y-3 rounded-2xl border border-white/10 p-4 text-sm">
                  <p className="font-semibold text-white">{t("Suivi du paiement")}</p>
                  {doc.payments.map((p) => (
                    <p key={p.id} className="text-slate-300">
                      {f.date(p.date)} — {f.money(p.amount)} ({p.method})
                    </p>
                  ))}
                  {reminder && (
                    <p className="text-slate-400">
                      {reminder.blocked ?? (reminder.nextDate ? `${t("Prochaine relance")} : ${t(STEP_LABEL(reminder))} — ${f.date(reminder.nextDate)}${reminder.fees + reminder.interest ? ` (${t("frais")} ${f.money(reminder.fees + reminder.interest)})` : ""}` : t("Toutes les relances ont été envoyées."))}
                    </p>
                  )}
                  <label className="flex items-start gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-emerald-500"
                      checked={doc.dispute.active}
                      onChange={(e) => update((d) => audit({ ...d, docs: d.docs.map((x) => (x.id === doc.id ? { ...x, dispute: { active: e.target.checked, note: x.dispute.note, since: todayIso() } } : x)) }, "dispute", "invoice", doc.id, String(e.target.checked)))}
                    />
                    <span>
                      {t("Contestation ou plan de paiement en cours")}
                      <span className="block text-xs text-slate-500">{t("Suspend les relances automatiques.")}</span>
                    </span>
                  </label>
                  {reminder?.due && (
                    <button onClick={() => setDialog({ reminder: true })} className="btn-primary !py-2 text-sm">
                      <Send className="h-4 w-4" /> {t("Envoyer la relance")}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm tabular-nums">
              {doc.type !== "credit" && (
                <label className="mb-2 flex items-center justify-between gap-2 text-slate-400">
                  {t("Remise globale (%)")}
                  <input type="number" step="0.5" className={cn(cellClass, "!w-20 text-right")} value={doc.globalDiscountPercent || ""} disabled={locked} onChange={(e) => patch({ globalDiscountPercent: e.target.valueAsNumber || 0 })} />
                </label>
              )}
              {totals.discount > 0 && <Row k={t("Remise")} v={`- ${f.money(totals.discount)}`} />}
              {doc.deductions.map((d, i) => (
                <Row key={i} k={t(d.label)} v={`- ${f.money(d.amount)}`} />
              ))}
              <Row k={t("Total HTVA")} v={f.money(totals.htva)} />
              {totals.vatRows.map((r) => (
                <Row key={r.code} k={`${t("TVA")} ${t(VAT_LABEL[r.code])} ${t("sur")} ${f.money(r.base)}`} v={f.money(r.vat)} />
              ))}
              <Row k={t("Total TVAC")} v={f.money(totals.tvac)} strong />
              {doc.type === "quote" && doc.depositPercent > 0 && <Row k={`${t("Acompte")} ${doc.depositPercent} %`} v={f.money(totals.deposit)} />}
              {totals.retention > 0 && <Row k={t("Retenue de garantie")} v={`- ${f.money(totals.retention)}`} />}
              {totals.paid > 0 && <Row k={t("Déjà payé")} v={`- ${f.money(totals.paid)}`} />}
              {doc.type === "invoice" && (totals.paid > 0 || totals.retention > 0) && <Row k={t("Reste à payer")} v={f.money(totals.due)} strong />}
              {totals.cost > 0 && showCost && (
                <p className="mt-2 border-t border-white/5 pt-2 text-xs text-slate-500">
                  {t("Coût estimé")} {f.money(totals.cost)} · {t("marge")} <span className="text-emerald">{f.money(totals.margin)} ({totals.htva ? Math.round((totals.margin / totals.htva) * 100) : 0} %)</span> — {t("visible uniquement par vous")}
                </p>
              )}
              {showCost && doc.lines.some((l) => l.executedBy) && (
                <ul className="mt-2 space-y-1 border-t border-white/5 pt-2 text-xs">
                  {quoteByExecution(doc.lines, doc.globalDiscountPercent).map((x) => (
                    <li key={x.key} className="flex justify-between gap-2 text-slate-400">
                      <span className="truncate">{x.key === OWN ? t("Notre société") : (data.suppliers.find((s2) => s2.id === x.key)?.name ?? t("Sous-traitant supprimé"))}</span>
                      <span className="shrink-0 tabular-nums">
                        {f.money(x.revenue)} · <span className={x.margin >= 0 ? "text-emerald" : "text-rose-300"}>{f.money(x.margin)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {doc.status === "cancelled" && (
            <Notice tone="warn">
              <Ban className="mr-1 inline h-4 w-4" /> {t("Facture annulée par une note de crédit.")}
            </Notice>
          )}
          {!locked && doc.lines.length > 0 && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Save className="h-3.5 w-3.5" /> {t("Enregistré automatiquement.")}
            </p>
          )}
        </div>
      <AnimatePresence>
        {calc && (
          <QuantityCalculator
            onClose={() => setCalc(false)}
            onInsert={(r) => {
              addLines([newLine({ label: r.label, qty: r.qty, unit: r.unit, category: r.category, toPrice: true })]);
              setCalc(false);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {newSubFor && (
          <NewSubcontractorDialog
            onClose={() => setNewSubFor(null)}
            onCreated={(sc) => {
              const id = newSubFor;
              setNewSubFor(null);
              // la fiche vient d'être créée : marge par défaut de la sous-traitance
              mapLine(id, (x) => withExecution({ settings: data.settings, suppliers: [...data.suppliers, sc] }, x, sc.id));
            }}
          />
        )}
      </AnimatePresence>
      </Modal>

      <AnimatePresence>
        {dialog === "send" && <SendDialog doc={doc} onClose={() => setDialog(null)} />}
        {dialog && typeof dialog === "object" && <SendDialog doc={doc} reminder onClose={() => setDialog(null)} />}
        {dialog === "sign" && client && (
          <SignDialog
            doc={doc}
            clientName={client.contactName || client.name}
            onClose={() => setDialog(null)}
            onSigned={(signature) => {
              run((d) => [signQuote(d, doc.id, signature), null]);
              setDialog(null);
            }}
          />
        )}
        {dialog === "pay" && <PaymentDialog doc={doc} onClose={() => setDialog(null)} />}
        {dialog === "deposit" && (
          <PromptDialog
            title={t("Facture d'acompte")}
            label={t("Pourcentage du devis (%)")}
            initial={doc.depositPercent || 30}
            onClose={() => setDialog(null)}
            onOk={(v) => {
              setDialog(null);
              onOpen(run((d) => quoteToInvoice(d, doc.id, "deposit", { percent: v })).id);
            }}
          />
        )}
        {dialog === "situation" && (
          <SituationDialog
            doc={doc}
            done={progressInvoiced(data, doc.id)}
            onClose={() => setDialog(null)}
            onOk={(progress) => {
              setDialog(null);
              onOpen(run((d) => quoteToInvoice(d, doc.id, "situation", { progress })).id);
            }}
          />
        )}
        {dialog === "metre" && (
          <ImportWizard
            title={t("Importer un métré (Excel / CSV)")}
            fields={METRE_FIELDS}
            onClose={() => setDialog(null)}
            plan={(parsed) => {
              const lines = parsed.map(({ values: v }) => {
                const label = String(v.label);
                const m = bestMatch(label, data.articles, { unit: String(v.unit ?? "") || undefined });
                const price = typeof v.price === "number" ? v.price : m ? m.article.salePrice : 0;
                return newLine({ label: `${v.ref ? `${v.ref} — ` : ""}${label}`, qty: typeof v.qty === "number" ? v.qty : 1, unit: String(v.unit ?? m?.article.unit ?? "u"), unitPrice: price, articleId: m?.article.id ?? null, category: m?.article.category ?? "installed_material", costPrice: m?.article.purchasePrice ?? 0, confidence: m?.confidence ?? 0, toPrice: price === 0 });
              });
              return {
                create: lines.length,
                update: 0,
                skipped: 0,
                preview: lines.map((l) => ({ label: l.label, detail: l.toPrice ? t("à chiffrer") : `${l.qty} ${l.unit} × ${f.money(l.unitPrice)}${l.articleId ? " ✓" : ""}` })),
                apply: () => addLines(lines),
              };
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const Mover = ({ i, move }: { i: number; move: (i: number, d: -1 | 1) => void }) => (
  <div className="flex flex-col">
    <button onClick={() => move(i, -1)} className="p-0.5 text-slate-500 hover:text-white" aria-label="↑">
      <ArrowUp className="h-3.5 w-3.5" />
    </button>
    <button onClick={() => move(i, 1)} className="p-0.5 text-slate-500 hover:text-white" aria-label="↓">
      <ArrowDown className="h-3.5 w-3.5" />
    </button>
  </div>
);
const Del = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="rounded-lg p-2 text-slate-500 hover:text-rose-400" aria-label="Supprimer">
    <Trash2 className="h-4 w-4" />
  </button>
);
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "border-t border-white/10 pt-2 font-display text-lg font-bold text-white" : "text-slate-400")}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function PromptDialog({ title, label, initial, onClose, onOk }: { title: string; label: string; initial: number; onClose: () => void; onOk: (v: number) => void }) {
  const { t } = useTr();
  const [v, setV] = useState(initial);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button onClick={() => onOk(v)} className="btn-primary text-sm">
            {t("Créer")}
          </button>
        </>
      }
    >
      <Field label={label}>
        <input type="number" className={inputClass} value={v} onChange={(e) => setV(e.target.valueAsNumber || 0)} />
      </Field>
    </Modal>
  );
}

function SituationDialog({ doc, done, onClose, onOk }: { doc: Doc; done: Map<string, number>; onClose: () => void; onOk: (p: Record<string, number>) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const items = doc.lines.filter(countsInTotal);
  const [p, setP] = useState<Record<string, number>>(Object.fromEntries(items.map((l) => [l.id, done.get(l.label) ?? 0])));
  const amount = round2(items.reduce((s, l) => s + (lineTotal(l) * Math.max(0, (p[l.id] ?? 0) - (done.get(l.label) ?? 0))) / 100, 0));
  return (
    <Modal
      title={t("État d'avancement")}
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button onClick={() => onOk(p)} disabled={amount <= 0} className="btn-primary text-sm disabled:opacity-40">
            {t("Créer la facture de situation ({a} HTVA)", { a: f.money(amount) })}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-400">{t("Indiquez l'avancement cumulé de chaque poste. Seule la part non encore facturée est reprise. Faites valider l'état par le client avant émission.")}</p>
      <ul className="divide-y divide-white/5">
        {items.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-200">{l.label}</span>
            <span className="text-xs text-slate-500">
              {t("déjà")} {done.get(l.label) ?? 0} %
            </span>
            <input type="range" min={0} max={100} step={5} value={p[l.id] ?? 0} onChange={(e) => setP((x) => ({ ...x, [l.id]: Number(e.target.value) }))} className="range w-40" style={{ ["--fill" as string]: `${p[l.id] ?? 0}%` }} />
            <span className="w-12 text-right tabular-nums">{p[l.id] ?? 0} %</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

const METHODS = ["Virement", "Bancontact", "Carte", "Espèces", "Domiciliation"];

function PaymentDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { run } = useAppData();
  const due = computeTotals(doc).due;
  const [amount, setAmount] = useState(due);
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState(METHODS[0]);
  return (
    <Modal
      title={t("Enregistrer un paiement")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button
            onClick={() => {
              run((d) => [addPayment(d, doc.id, { date, amount, method, reference: doc.structuredComm }), null]);
              onClose();
            }}
            disabled={amount <= 0}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-400">
        {t("Reste dû")} : <strong className="text-white">{f.money(due)}</strong> — {t("un paiement partiel laisse la facture « partiellement payée ».")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Montant")}>
          <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.valueAsNumber || 0)} />
        </Field>
        <Field label={t("Date")}>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("Moyen")}>
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

