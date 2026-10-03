"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, HardHat, Plus, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { todayIso, uid } from "@/lib/app/defaults";
import { ATTESTATION_LABEL, REQUIRED_ATTESTATIONS, attestationState, lastCheck, recordRetentionCheck, subcontractorAlerts, subcontractorSummary, type AttestationState } from "@/lib/app/subcontractors";
import { purchaseTotals, retentionFor } from "@/lib/app/finance";
import { formatBce, isBce, isIban } from "@/lib/tax/belgium";
import { emptyAddress, type Attestation, type AttestationKind, type RetentionCheck, type Supplier } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, Notice, PageHeader, Stat, Toggle, inputClass } from "./ui";

const STATE_STYLE: Record<AttestationState, { label: string; style: string }> = {
  valid: { label: "Valide", style: "bg-emerald/10 text-emerald ring-emerald/30" },
  expiring: { label: "Expire bientôt", style: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  expired: { label: "Expirée", style: "bg-rose-500/10 text-rose-300 ring-rose-500/30" },
  missing: { label: "Manquante", style: "bg-white/5 text-slate-400 ring-white/10" },
};

function SubcontractorDetail({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, update, putBlob, blobUrl } = useAppData();
  const [s, setS] = useState<Supplier>({ attestations: [], retentionChecks: [], ...supplier });
  const [check, setCheck] = useState<RetentionCheck>({ checkedAt: todayIso(), taxDebt: false, onssDebt: false, inastiDebt: false, attestationId: "" });
  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setS((x) => ({ ...x, [k]: v }));
  const atts = s.attestations ?? [];
  const setAtt = (id: string, patch: Partial<Attestation>) => set("attestations", atts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const invoices = data.purchases.filter((p) => p.supplierId === s.id && p.type === "invoice").sort((a, b) => b.date.localeCompare(a.date));
  const bceErr = s.bce && !isBce(s.bce);
  const ibanErr = s.iban && !isIban(s.iban);

  const save = () => {
    upsert("suppliers", { ...s, bce: s.bce ? formatBce(s.bce) : "" });
    onClose();
  };

  return (
    <Modal
      wide="xl"
      title={s.name || t("Nouveau sous-traitant")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!s.name.trim() || !!bceErr} onClick={save} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${t("Nom")} *`}>
            <input className={inputClass} value={s.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("Numéro d'entreprise (BCE)")} error={bceErr && t("Numéro BCE invalide (contrôle modulo 97).")}>
            <input className={inputClass} value={s.bce} onChange={(e) => set("bce", e.target.value)} placeholder="0123.456.789" />
          </Field>
          <Field label={t("N° de TVA")}>
            <input className={inputClass} value={s.vatNumber ?? ""} onChange={(e) => set("vatNumber", e.target.value.toUpperCase())} placeholder={s.bce ? `BE${s.bce.replace(/\D/g, "")}` : "BE0123456789"} />
          </Field>
          <Field label="IBAN" error={ibanErr && t("IBAN invalide")}>
            <input className={inputClass} value={s.iban ?? ""} onChange={(e) => set("iban", e.target.value.toUpperCase())} />
          </Field>
          <Field label={t("E-mail")}>
            <input className={inputClass} value={s.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={t("Téléphone")}>
            <input className={inputClass} value={s.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Attestations")}</p>
            <button onClick={() => set("attestations", [...atts, { id: uid(), kind: REQUIRED_ATTESTATIONS.find((k) => !atts.some((a) => a.kind === k)) ?? "other", reference: "", validUntil: null, fileId: null }])} className="btn-ghost !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t("Ajouter")}
            </button>
          </div>
          <div className="space-y-2">
            {atts.map((a) => {
              const st = STATE_STYLE[attestationState(a)];
              return (
                <div key={a.id} className="grid items-center gap-2 rounded-xl border border-white/10 p-2 sm:grid-cols-[1.4fr_1fr_10rem_auto_auto_auto]">
                  <select className={cn(inputClass, "!py-2")} value={a.kind} onChange={(e) => setAtt(a.id, { kind: e.target.value as AttestationKind })}>
                    {(Object.keys(ATTESTATION_LABEL) as AttestationKind[]).map((k) => (
                      <option key={k} value={k}>
                        {t(ATTESTATION_LABEL[k])}
                      </option>
                    ))}
                  </select>
                  <input className={cn(inputClass, "!py-2")} value={a.reference} onChange={(e) => setAtt(a.id, { reference: e.target.value })} placeholder={t("Référence / n° de police")} />
                  <input type="date" className={cn(inputClass, "!py-2")} value={a.validUntil ?? ""} onChange={(e) => setAtt(a.id, { validUntil: e.target.value || null })} title={t("Valable jusqu'au")} />
                  <Badge label={t(st.label)} style={st.style} />
                  {a.fileId ? (
                    <button onClick={async () => { const u = await blobUrl(`file:${a.fileId}`); if (u) window.open(u, "_blank"); }} className="text-xs text-cyan">
                      {t("Voir")}
                    </button>
                  ) : (
                    <label className="cursor-pointer text-slate-400 hover:text-cyan" title={t("Joindre le document")}>
                      <FileUp className="h-4 w-4" />
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const id = uid();
                          await putBlob(`file:${id}`, file);
                          setAtt(a.id, { fileId: id });
                        }}
                      />
                    </label>
                  )}
                  <button onClick={() => set("attestations", atts.filter((x) => x.id !== a.id))} className="text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {!atts.length && <p className="text-sm text-slate-500">{t("Aucune attestation enregistrée.")}</p>}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-amber-300" /> {t("Obligation de retenue (art. 30bis ONSS / art. 403 CIR)")}
          </p>
          <p className="text-xs text-slate-400">{t("Consultez le service officiel le jour du paiement avec le numéro d'entreprise, puis encodez le résultat : il s'applique aux factures non payées de ce sous-traitant.")}</p>
          <a href="https://www.socialsecurity.be/site_fr/general/helpcentre/obligation_retenue/index.htm" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan">
            {t("Service de consultation de l'obligation de retenue")} <ExternalLink className="h-3 w-3" />
          </a>
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label={t("Date de consultation")}>
              <input type="date" className={inputClass} value={check.checkedAt} onChange={(e) => setCheck({ ...check, checkedAt: e.target.value })} />
            </Field>
            <Toggle checked={check.onssDebt} onChange={(v) => setCheck({ ...check, onssDebt: v })} label={t("Dettes sociales (ONSS)")} />
            <Toggle checked={check.taxDebt} onChange={(v) => setCheck({ ...check, taxDebt: v })} label={t("Dettes fiscales (SPF Finances)")} />
            <Toggle checked={check.inastiDebt} onChange={(v) => setCheck({ ...check, inastiDebt: v })} label={t("Dettes INASTI")} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("Référence de la consultation")} className="min-w-[200px] flex-1">
              <input className={inputClass} value={check.attestationId ?? ""} onChange={(e) => setCheck({ ...check, attestationId: e.target.value })} />
            </Field>
            <button
              onClick={() => {
                update((d) => recordRetentionCheck(d, s.id, check));
                setS((x) => ({ ...x, retentionChecks: [...(x.retentionChecks ?? []), check] }));
              }}
              className="btn-primary !py-2.5 text-sm"
            >
              <ShieldCheck className="h-4 w-4" /> {t("Enregistrer la consultation")}
            </button>
          </div>
          {(s.retentionChecks ?? []).length > 0 && (
            <ul className="space-y-1 text-xs text-slate-400">
              {[...(s.retentionChecks ?? [])].reverse().map((c, i) => (
                <li key={i}>
                  {f.date(c.checkedAt)} — {c.onssDebt || c.taxDebt || c.inastiDebt ? [c.onssDebt && "ONSS", c.taxDebt && "SPF", c.inastiDebt && "INASTI"].filter(Boolean).join(" + ") + ` ${t("dettes")}` : t("aucune dette")} {c.attestationId && `· ${c.attestationId}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Factures")}</p>
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
            {invoices.map((p) => {
              const tot = purchaseTotals(p);
              const r = retentionFor(tot.ht, p.retention, p.date);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-slate-200">
                    {p.number || "—"} <span className="text-slate-500">· {f.date(p.date)} · {data.jobs.find((j) => j.id === p.jobId)?.name ?? "—"}</span>
                  </span>
                  <span className="tabular-nums">{f.money(tot.ttc)}</span>
                  {r.total > 0 && <span className="text-xs text-amber-300">{t("retenue")} {f.money(r.total)}</span>}
                  {p.status === "paid" ? <CheckCircle2 className="h-4 w-4 text-emerald" /> : p.retention ? <ShieldCheck className="h-4 w-4 text-cyan" /> : <ShieldAlert className="h-4 w-4 text-rose-400" />}
                </li>
              );
            })}
            {!invoices.length && <li className="p-4 text-slate-500">{t("Aucune facture.")}</li>}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export function SubcontractorsTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [open, setOpen] = useState<Supplier | null>(null);
  const subs = data.suppliers.filter((s) => s.kind === "subcontractor");
  const alerts = subcontractorAlerts(data);
  const totals = subs.map((s) => subcontractorSummary(data, s.id));
  const blank = (): Supplier => ({ id: uid(), kind: "subcontractor", name: "", bce: "", email: "", phone: "", address: emptyAddress(), trade: "", importMapping: null, notes: "", attestations: [], retentionChecks: [] });

  return (
    <div>
      <PageHeader
        title={t("Sous-traitants")}
        subtitle={t("Attestations, obligation de retenue 30bis, retenue de garantie")}
        actions={
          <button onClick={() => setOpen(blank())} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> {t("Sous-traitant")}
          </button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label={t("Sous-traitants")} value={String(subs.length)} />
        <Stat label={t("À payer (TVAC)")} value={f.money0(totals.reduce((s, x) => s + x.toPay, 0))} />
        <Stat label={t("Retenues à verser")} value={f.money0(totals.reduce((s, x) => s + x.retentionOnss + x.retentionTax, 0))} sub={t("ONSS {o} · SPF {s}", { o: f.money0(totals.reduce((s, x) => s + x.retentionOnss, 0)), s: f.money0(totals.reduce((s, x) => s + x.retentionTax, 0)) })} />
        <Stat label={t("Alertes")} value={String(alerts.length)} tone={alerts.some((a) => a.level === "danger") ? "danger" : alerts.length ? "warn" : "ok"} />
      </div>
      {alerts.length > 0 && (
        <div className="card mb-4 space-y-1.5 p-4 text-sm">
          {alerts.slice(0, 12).map((a, i) => (
            <button key={i} onClick={() => setOpen(data.suppliers.find((s) => s.id === a.supplierId) ?? null)} className="flex w-full items-start gap-2 text-left">
              <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", a.level === "danger" ? "text-rose-400" : "text-amber-300")} />
              <span className="text-slate-300">
                <strong className="text-white">{data.suppliers.find((s) => s.id === a.supplierId)?.name}</strong> — {t(a.text)}
              </span>
            </button>
          ))}
        </div>
      )}
      {!subs.length ? (
        <Empty icon={HardHat} text={t("Ajoutez vos sous-traitants : attestations, contrôle de l'obligation de retenue avant chaque paiement.")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subs.map((s, i) => {
            const last = lastCheck(s);
            return (
              <button key={s.id} onClick={() => setOpen(s)} className="card space-y-3 p-5 text-left">
                <div>
                  <p className="font-semibold text-white">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.bce ? `BCE ${s.bce}` : t("BCE manquant")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIRED_ATTESTATIONS.map((k) => {
                    const st = attestationState((s.attestations ?? []).find((a) => a.kind === k));
                    return <Badge key={k} label={`${t(ATTESTATION_LABEL[k]).split(" (")[0]} · ${t(STATE_STYLE[st].label)}`} style={STATE_STYLE[st].style} />;
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  {t("À payer")} {f.money0(totals[i].toPay)} · {last ? t("30bis vérifié le {d}", { d: f.date(last.checkedAt) }) : t("30bis jamais vérifié")}
                </p>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4">
        <Notice>{t("Retenue de garantie : {p} % par défaut sur les états d'avancement et factures finales des clients professionnels (Paramètres → Devis & factures).", { p: data.settings.retentionGuaranteePercent })}</Notice>
      </div>
      <AnimatePresence>{open && <SubcontractorDetail key={open.id} supplier={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}
