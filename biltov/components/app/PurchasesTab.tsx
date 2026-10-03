"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Building2, CheckCircle2, ExternalLink, PackageCheck, Plus, ScanLine, ShieldAlert, ShoppingCart, Trash2, Truck } from "lucide-react";
import { compareOrder, invoiceGap, nextOrderStatus, statusesFor } from "@/lib/app/orders";
import { PurchaseScan } from "./PurchaseScan";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, nextNumber, todayIso, uid } from "@/lib/app/defaults";
import { purchaseTotals, retentionFor } from "@/lib/app/finance";
import { formatBce, isBce } from "@/lib/tax/belgium";
import { round2 } from "@/lib/app/money";
import { emptyAddress, type Purchase, type PurchaseStatus, type Supplier } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, DataTable, Empty, Field, Modal, Notice, PageHeader, SearchBox, Stat, SubTabs, Toggle, cellClass, inputClass } from "./ui";

export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; style: string }> = {
  draft: { label: "Brouillon", style: "bg-white/5 text-slate-300 ring-white/10" },
  ordered: { label: "Commandé", style: "bg-blue/15 text-sky-300 ring-blue/30" },
  preparing: { label: "En préparation", style: "bg-violet-500/10 text-violet-300 ring-violet-500/30" },
  delivered: { label: "Livré sur chantier", style: "bg-cyan/10 text-cyan ring-cyan/30" },
  verified: { label: "Vérifié", style: "bg-emerald/10 text-emerald ring-emerald/30" },
  received: { label: "Réceptionné", style: "bg-cyan/10 text-cyan ring-cyan/30" },
  to_pay: { label: "À payer", style: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  paid: { label: "Payé", style: "bg-emerald/10 text-emerald ring-emerald/30" },
};

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { t } = useTr();
  const { upsert } = useAppData();
  const [s, setS] = useState<Supplier>(supplier ?? { id: uid(), kind: "supplier", name: "", bce: "", email: "", phone: "", address: emptyAddress(), trade: "", importMapping: null, notes: "" });
  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setS((x) => ({ ...x, [k]: v }));
  const bceErr = s.bce && !isBce(s.bce);
  return (
    <Modal
      title={supplier ? s.name : t("Nouveau fournisseur / sous-traitant")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!s.name.trim() || !!bceErr} onClick={() => (upsert("suppliers", { ...s, bce: s.bce ? formatBce(s.bce) : "" }), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Type")}>
          <select className={inputClass} value={s.kind} onChange={(e) => set("kind", e.target.value as Supplier["kind"])}>
            <option value="supplier">{t("Fournisseur / négoce")}</option>
            <option value="subcontractor">{t("Sous-traitant")}</option>
          </select>
        </Field>
        <Field label={`${t("Nom")} *`}>
          <input className={inputClass} value={s.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("Numéro d'entreprise (BCE)")} error={bceErr && t("Numéro BCE invalide (contrôle modulo 97).")}>
          <input className={inputClass} value={s.bce} onChange={(e) => set("bce", e.target.value)} placeholder="0123.456.789" />
        </Field>
        <Field label={t("E-mail")}>
          <input type="email" className={inputClass} value={s.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label={t("Téléphone")}>
          <input className={inputClass} value={s.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={t("Rue et numéro")}>
          <input className={inputClass} value={s.address.street} onChange={(e) => set("address", { ...s.address, street: e.target.value })} />
        </Field>
        <Field label={t("Code postal")}>
          <input className={inputClass} value={s.address.postcode} onChange={(e) => set("address", { ...s.address, postcode: e.target.value })} />
        </Field>
        <Field label={t("Localité")}>
          <input className={inputClass} value={s.address.city} onChange={(e) => set("address", { ...s.address, city: e.target.value })} />
        </Field>
        <Field label={t("Notes")} className="sm:col-span-2">
          <textarea rows={2} className={inputClass} value={s.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        {s.kind === "subcontractor" && (
          <div className="sm:col-span-2">
            <Notice>{t("Sous-traitant en construction : avant chaque paiement, vérifiez l'obligation de retenue (dettes ONSS et fiscales). Biltov calcule les montants à retenir sur la facture.")}</Notice>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PurchaseForm({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, remove } = useAppData();
  const [p, setP] = useState(purchase);
  const set = <K extends keyof Purchase>(k: K, v: Purchase[K]) => setP((x) => ({ ...x, [k]: v }));
  const supplier = data.suppliers.find((s) => s.id === p.supplierId);
  const tot = purchaseTotals(p);
  const ret = retentionFor(tot.ht, p.retention, todayIso());
  const exists = data.purchases.some((x) => x.id === p.id);
  const setLine = (id: string, patch: Partial<Purchase["lines"][number]>) => set("lines", p.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const fromQuote = () => {
    const quote = data.docs.find((d) => d.jobId === p.jobId && d.type === "quote" && d.status === "accepted");
    if (!quote) return;
    const lines = quote.lines
      .filter((l) => l.kind === "item" && l.articleId && (l.category === "supply_only" || l.category === "installed_material"))
      .map((l) => {
        const a = data.articles.find((x) => x.id === l.articleId);
        return { id: uid(), articleId: l.articleId, label: a?.name.fr || l.label, qty: l.qty, unitPrice: a?.purchasePrice ?? l.costPrice, vat: 21 };
      });
    set("lines", [...p.lines.filter((l) => l.label), ...lines]);
  };

  const save = () => {
    update((d) => {
      let next = p;
      let settings = d.settings;
      if (p.type === "order" && !p.number) {
        const n = nextNumber(d.settings, "order");
        next = { ...p, number: n.number };
        settings = { ...d.settings, counters: n.counters };
      }
      return { ...d, settings, purchases: d.purchases.some((x) => x.id === p.id) ? d.purchases.map((x) => (x.id === p.id ? next : x)) : [next, ...d.purchases] };
    });
    onClose();
  };

  const receive = () => {
    update((d) => ({
      ...d,
      purchases: ((received: Purchase) => (exists ? d.purchases.map((x) => (x.id === p.id ? received : x)) : [received, ...d.purchases]))({ ...p, status: "received" }),
      stockMoves: [...d.stockMoves, ...p.lines.filter((l) => l.articleId).map((l) => ({ id: uid(), articleId: l.articleId!, locationId: d.stockLocations[0]?.id ?? "depot", qty: l.qty, date: todayIso(), reason: `${t("Réception")} ${p.number}`, jobId: null }))],
    }));
    onClose();
  };

  return (
    <Modal
      wide="xl"
      title={p.type === "order" ? t("Bon de commande {n}", { n: p.number || t("(numéro attribué à l'enregistrement)") }) : p.type === "delivery" ? t("Bon de livraison {n}", { n: p.number || "" }) : t("Facture fournisseur {n}", { n: p.number || "" })}
      onClose={onClose}
      footer={
        <>
          {exists && (
            <button onClick={() => window.confirm(t("Supprimer ?")) && (remove("purchases", p.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          {(p.type === "order" || p.type === "delivery") && ["ordered", "preparing", "delivered"].includes(p.status) && data.settings.modules.stock && (
            <button onClick={receive} className="btn-ghost text-sm">
              <PackageCheck className="h-4 w-4" /> {t("Réceptionner en stock")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!p.supplierId} onClick={save} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${t("Fournisseur")} *`}>
            <select className={inputClass} value={p.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
              <option value="">—</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.kind === "subcontractor" ? `(${t("sous-traitant")})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Chantier")}>
            <select className={inputClass} value={p.jobId ?? ""} onChange={(e) => set("jobId", e.target.value || null)}>
              <option value="">{t("Stock / frais généraux")}</option>
              {data.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Numéro")}>
            <input className={inputClass} value={p.number} onChange={(e) => set("number", e.target.value)} />
          </Field>
          <Field label={t("Date")}>
            <input type="date" className={inputClass} value={p.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label={p.type === "order" ? t("Livraison souhaitée") : t("Échéance")}>
            <input type="date" className={inputClass} value={p.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
          <Field label={t("Statut")}>
            <select className={inputClass} value={p.status} onChange={(e) => setP((x) => ({ ...x, status: e.target.value as PurchaseStatus, paidAt: e.target.value === "paid" ? x.paidAt ?? todayIso() : null }))}>
              {statusesFor(p.type).map((s) => (
                <option key={s} value={s}>
                  {t(PURCHASE_STATUS[s].label)}
                </option>
              ))}
            </select>
          </Field>
          {p.type !== "order" && (
            <Field label={t("Bon de commande lié")}>
              <select className={inputClass} value={p.orderId ?? ""} onChange={(e) => set("orderId", e.target.value || null)}>
                <option value="">—</option>
                {data.purchases
                  .filter((o) => o.type === "order" && o.supplierId === p.supplierId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number || "—"} — {f.date(o.date)}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-2">{t("Désignation")}</th>
                <th className="w-20 p-2">{t("Qté")}</th>
                <th className="w-28 p-2">{t("PU HTVA")}</th>
                <th className="w-20 p-2">{t("TVA %")}</th>
                <th className="w-24 p-2 text-right">{t("Total")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="p-1.5">
                    <input list="purchase-articles" className={cn(cellClass, "w-full")} value={l.label} onChange={(e) => {
                      const a = data.articles.find((x) => x.name.fr === e.target.value);
                      setLine(l.id, a ? { label: a.name.fr, articleId: a.id, unitPrice: a.purchasePrice } : { label: e.target.value, articleId: null });
                    }} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" className={cn(cellClass, "w-full")} value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.valueAsNumber || 0 })} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" step="0.01" className={cn(cellClass, "w-full")} value={l.unitPrice} onChange={(e) => setLine(l.id, { unitPrice: e.target.valueAsNumber || 0 })} />
                  </td>
                  <td className="p-1.5">
                    <select className={cn(cellClass, "w-full")} value={l.vat} onChange={(e) => setLine(l.id, { vat: Number(e.target.value) })}>
                      {[21, 12, 6, 0].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5 text-right tabular-nums text-slate-200">{f.money(round2(l.qty * l.unitPrice))}</td>
                  <td>
                    <button onClick={() => set("lines", p.lines.filter((x) => x.id !== l.id))} className="p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="purchase-articles">
            {data.articles
              .filter((a) => a.active && a.type !== "labour")
              .map((a) => (
                <option key={a.id} value={a.name.fr} />
              ))}
          </datalist>
          <div className="flex flex-wrap gap-2 border-t border-white/5 p-2">
            <button onClick={() => set("lines", [...p.lines, { id: uid(), articleId: null, label: "", qty: 1, unitPrice: 0, vat: supplier?.kind === "subcontractor" ? 0 : 21 }])} className="btn-ghost !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t("Ligne")}
            </button>
            {p.jobId && data.docs.some((d) => d.jobId === p.jobId && d.type === "quote" && d.status === "accepted") && (
              <button onClick={fromQuote} className="btn-ghost !py-1.5 text-xs">
                <ShoppingCart className="h-3.5 w-3.5" /> {t("Reprendre les fournitures du devis signé")}
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-6 text-sm">
          <span className="text-slate-400">
            HTVA <span className="tabular-nums text-white">{f.money(tot.ht)}</span>
          </span>
          <span className="text-slate-400">
            TVA <span className="tabular-nums text-white">{f.money(tot.vat)}</span>
          </span>
          <span className="text-slate-400">
            TVAC <span className="font-semibold tabular-nums text-white">{f.money(tot.ttc)}</span>
          </span>
        </div>

        {supplier?.kind === "subcontractor" && p.type === "invoice" && (
          <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="flex items-center gap-2 font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-amber-300" /> {t("Obligation de retenue (art. 30bis ONSS / art. 403 CIR)")}
            </p>
            <p className="text-xs text-slate-400">{t("À vérifier le jour du paiement sur le service en ligne officiel, avec le numéro d'entreprise du sous-traitant.")}</p>
            <a href="https://www.socialsecurity.be/site_fr/general/helpcentre/obligation_retenue/index.htm" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan">
              {t("Service de consultation de l'obligation de retenue")} <ExternalLink className="h-3 w-3" />
            </a>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["onssDebt", t("Dettes sociales (ONSS)")],
                  ["taxDebt", t("Dettes fiscales (SPF Finances)")],
                  ["inastiDebt", t("Dettes INASTI")],
                ] as const
              ).map(([k, label]) => (
                <Toggle key={k} checked={!!p.retention?.[k]} onChange={(v) => set("retention", { checkedAt: todayIso(), taxDebt: false, onssDebt: false, inastiDebt: false, attestationId: null, ...p.retention, [k]: v })} label={label} />
              ))}
            </div>
            <Field label={t("Référence de la consultation")}>
              <input className={inputClass} value={p.retention?.attestationId ?? ""} onChange={(e) => set("retention", { checkedAt: todayIso(), taxDebt: false, onssDebt: false, inastiDebt: false, ...p.retention, attestationId: e.target.value })} />
            </Field>
            {p.retention ? (
              ret.total > 0 ? (
                <Notice tone="warn">
                  {t("À retenir")} : ONSS {f.money(ret.onss)} · SPF Finances {f.money(ret.tax)}
                  {ret.inasti ? ` · INASTI ${f.money(ret.inasti)}` : ""}. {t("À payer au sous-traitant")} : {f.money(round2(ret.toSupplier + tot.vat))}.
                </Notice>
              ) : (
                <Notice tone="ok">
                  {t("Vérifié le {d} : aucune dette, paiement intégral.", { d: f.date(p.retention.checkedAt) })}
                </Notice>
              )
            ) : (
              <Notice tone="danger">{t("Vérification non encore effectuée.")}</Notice>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Rapprochement bon de commande / bons de livraison / facture du grossiste. */
function OrderCompare({ order, onClose }: { order: Purchase; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const rows = compareOrder(data, order.id);
  const gap = invoiceGap(rows);
  const ISSUE: Record<string, string> = { missing: "non livré", short: "livraison incomplète", over: "quantité en trop", extra: "hors commande", price: "prix différent" };
  return (
    <Modal
      wide
      title={t("Commande {n} : commandé, livré, facturé", { n: order.number })}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Fermer")}
          </button>
          {order.status !== "verified" && (
            <button onClick={() => (upsert("purchases", { ...order, status: "verified" }), onClose())} className="btn-primary text-sm">
              <CheckCircle2 className="h-4 w-4" /> {t("Marquer comme vérifiée")}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-2">{t("Article")}</th>
                <th className="p-2 text-right">{t("Commandé")}</th>
                <th className="p-2 text-right">{t("Livré")}</th>
                <th className="p-2 text-right">{t("Facturé")}</th>
                <th className="p-2 text-right">{t("Prix cmd / fact.")}</th>
                <th className="p-2">{t("Écarts")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-white/5">
                  <td className="p-2 text-slate-200">{r.label}</td>
                  <td className="p-2 text-right">{r.ordered}</td>
                  <td className="p-2 text-right">{r.delivered}</td>
                  <td className="p-2 text-right">{r.invoiced}</td>
                  <td className="p-2 text-right">
                    {f.money(r.orderPrice)} / {r.invoicePrice !== null ? f.money(r.invoicePrice) : "—"}
                  </td>
                  <td className="p-2">{r.issues.length ? <span className="text-amber-300">{r.issues.map((i) => t(ISSUE[i])).join(", ")}</span> : <CheckCircle2 className="h-4 w-4 text-emerald" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {gap !== 0 && <Notice tone="warn">{t("Écart de prix facturé par rapport à la commande : {g} HTVA.", { g: f.money(gap) })}</Notice>}
      </div>
    </Modal>
  );
}

export function PurchasesTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const [tab, setTab] = useState<"invoices" | "orders" | "deliveries" | "suppliers">("invoices");
  const [scan, setScan] = useState(false);
  const [compare, setCompare] = useState<Purchase | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [supplier, setSupplier] = useState<Supplier | "new" | null>(null);
  const [sort, setSort] = useState({ key: "date", dir: "desc" as "asc" | "desc" });
  const today = todayIso();
  const sup = (id: string) => data.suppliers.find((s) => s.id === id);
  const toPay = data.purchases.filter((p) => p.type === "invoice" && p.status !== "paid");
  const unchecked = toPay.filter((p) => sup(p.supplierId)?.kind === "subcontractor" && !p.retention);

  const newPurchase = (type: Purchase["type"]): Purchase => {
    return { id: uid(), type, supplierId: data.suppliers[0]?.id ?? "", jobId: null, number: "", date: today, dueDate: addDays(today, type === "order" ? 7 : 30), lines: [{ id: uid(), articleId: null, label: "", qty: 1, unitPrice: 0, vat: 21 }], status: type === "order" ? "draft" : "to_pay", source: "manual", retention: null, paidAt: null, fileId: null };
  };

  const s = q.trim().toLowerCase();
  const typeOf = { invoices: "invoice", orders: "order", deliveries: "delivery", suppliers: "" }[tab];
  const list = data.purchases.filter((p) => p.type === typeOf && (!s || [p.number, sup(p.supplierId)?.name ?? "", data.jobs.find((j) => j.id === p.jobId)?.name ?? ""].some((x) => x.toLowerCase().includes(s))));

  return (
    <div>
      <PageHeader
        title={t("Achats & sous-traitance")}
        subtitle={t("Commandes, factures fournisseurs, obligation de retenue")}
        actions={
          <>
            <button onClick={() => setSupplier("new")} className="btn-ghost !py-2.5 text-sm">
              <Building2 className="h-4 w-4" /> {t("Fournisseur")}
            </button>
            <button onClick={() => setScan(true)} className="btn-ghost !py-2.5 text-sm">
              <ScanLine className="h-4 w-4" /> {t("Scanner")}
            </button>
            <button onClick={() => setEditing(newPurchase("order"))} className="btn-ghost !py-2.5 text-sm" disabled={!data.suppliers.length}>
              <Truck className="h-4 w-4" /> {t("Commande")}
            </button>
            <button onClick={() => setEditing(newPurchase("invoice"))} className="btn-primary !py-2.5 text-sm" disabled={!data.suppliers.length}>
              <Plus className="h-4 w-4" /> {t("Facture fournisseur")}
            </button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label={t("À payer (TVAC)")} value={f.money0(toPay.reduce((s, p) => s + purchaseTotals(p).ttc, 0))} sub={t("{n} facture(s)", { n: toPay.length })} />
        <Stat label={t("En retard")} value={String(toPay.filter((p) => p.dueDate < today).length)} tone={toPay.some((p) => p.dueDate < today) ? "warn" : undefined} />
        <Stat label={t("Retenue non vérifiée")} value={String(unchecked.length)} tone={unchecked.length ? "danger" : "ok"} sub={t("factures de sous-traitants")} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SubTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "invoices", label: t("Factures"), count: data.purchases.filter((p) => p.type === "invoice").length },
            { id: "orders", label: t("Commandes"), count: data.purchases.filter((p) => p.type === "order" && p.status !== "verified").length },
            { id: "deliveries", label: t("Bons de livraison"), count: data.purchases.filter((p) => p.type === "delivery").length },
            { id: "suppliers", label: t("Fournisseurs"), count: data.suppliers.length },
          ]}
        />
        {tab !== "suppliers" && (
          <div className="min-w-[240px] flex-1">
            <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher : numéro, fournisseur, chantier…")} />
          </div>
        )}
      </div>

      {tab === "suppliers" ? (
        !data.suppliers.length ? (
          <Empty icon={Building2} text={t("Ajoutez vos négoces et sous-traitants.")} action={<button onClick={() => setSupplier("new")} className="btn-primary text-sm"><Plus className="h-4 w-4" /> {t("Fournisseur")}</button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.suppliers.map((s) => (
              <button key={s.id} onClick={() => setSupplier(s)} className="card p-4 text-left">
                <p className="font-semibold text-white">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.kind === "subcontractor" ? t("Sous-traitant") : t("Fournisseur")} {s.bce && `· BCE ${s.bce}`}
                </p>
                <p className="mt-2 text-xs text-slate-400">{t("{n} document(s)", { n: data.purchases.filter((p) => p.supplierId === s.id).length })}</p>
              </button>
            ))}
          </div>
        )
      ) : (
        <DataTable
          rows={list}
          onRow={setEditing}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
          empty={t("Aucun document.")}
          cols={[
            { key: "number", label: t("Numéro"), sort: (p) => p.number, render: (p) => <span className="font-semibold text-slate-100">{p.number || "—"}</span> },
            { key: "supplier", label: t("Fournisseur"), sort: (p) => sup(p.supplierId)?.name ?? "", render: (p) => <span className="text-slate-300">{sup(p.supplierId)?.name}</span> },
            { key: "job", label: t("Chantier"), sort: (p) => data.jobs.find((j) => j.id === p.jobId)?.name ?? "", render: (p) => <span className="text-slate-400">{data.jobs.find((j) => j.id === p.jobId)?.name ?? "—"}</span> },
            { key: "date", label: t("Date"), sort: (p) => p.date, render: (p) => <span className="tabular-nums text-slate-400">{f.date(p.date)}</span> },
            { key: "due", label: tab === "orders" ? t("Livraison") : t("Échéance"), sort: (p) => p.dueDate, render: (p) => <span className={cn("tabular-nums", p.status !== "paid" && p.dueDate < today && tab === "invoices" ? "text-amber-300" : "text-slate-400")}>{f.date(p.dueDate)}</span> },
            { key: "amount", label: "TVAC", sort: (p) => purchaseTotals(p).ttc, render: (p) => <span className="font-semibold tabular-nums">{f.money(purchaseTotals(p).ttc)}</span>, className: "text-right" },
            {
              key: "status",
              label: t("Statut"),
              sort: (p) => p.status,
              render: (p) => (
                <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge label={t(PURCHASE_STATUS[p.status].label)} style={PURCHASE_STATUS[p.status].style} />
                  {p.type === "order" && nextOrderStatus(p.status) && (
                    <button onClick={() => upsert("purchases", { ...p, status: nextOrderStatus(p.status)! })} className="rounded-lg border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:border-cyan/50 hover:text-cyan" title={t("Étape suivante")}>
                      → {t(PURCHASE_STATUS[nextOrderStatus(p.status)!].label)}
                    </button>
                  )}
                  {p.type === "order" && data.purchases.some((x) => x.orderId === p.id) && (
                    <button onClick={() => setCompare(p)} className="rounded-lg border border-white/10 px-2 py-0.5 text-xs text-slate-300 hover:border-cyan/50 hover:text-cyan">
                      {t("Comparer")}
                    </button>
                  )}
                  {sup(p.supplierId)?.kind === "subcontractor" && p.type === "invoice" && (p.retention ? <CheckCircle2 className="h-4 w-4 text-emerald" /> : <ShieldAlert className="h-4 w-4 text-rose-400" />)}
                </span>
              ),
            },
          ]}
        />
      )}
      <AnimatePresence>
        {editing && <PurchaseForm key={editing.id} purchase={editing} onClose={() => setEditing(null)} />}
        {supplier && <SupplierForm supplier={supplier === "new" ? null : supplier} onClose={() => setSupplier(null)} />}
        {scan && (
          <PurchaseScan
            onClose={() => setScan(false)}
            onCreated={(p) => {
              setScan(false);
              setTab(p.type === "delivery" ? "deliveries" : "invoices");
            }}
          />
        )}
        {compare && <OrderCompare order={compare} onClose={() => setCompare(null)} />}
      </AnimatePresence>
    </div>
  );
}
