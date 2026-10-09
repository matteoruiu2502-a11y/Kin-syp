"use client";

// Page « Mon abonnement » : forfait actuel, factures Peppol utilisées, changement de forfait (au prorata),
// historique de facturation, moyen de paiement et annulation. Tous les chiffres viennent de lib/plans.ts.

import { useEffect, useState } from "react";
import { Check, CreditCard, ExternalLink, FileText, Loader2, Lock } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { isSuperAdmin } from "@/lib/app/permissions";
import { HIGHLIGHTED_PLAN, PLANS, PLAN_ORDER, TRIAL, VAT_RATE, YEARLY_FREE_MONTHS, monthlyEquivalentHT, priceHT, priceTTC, type Cycle, type PlanId } from "@/lib/plans";
import { activeUsers, downgradeBlocked, downgradeIssues, featuresInUse, type DowngradeIssue } from "@/lib/billing/entitlement";
import { BillingError, billingApi, billingConfigured, type BillingInvoice } from "@/lib/billing/client";
import { cn } from "@/lib/utils";
import { Modal, Notice, PageHeader } from "./ui";
import { UsageMeter, featureLabel } from "./PlanGate";

const STATUS_LABEL = { trial: "Essai gratuit", active: "Actif", past_due: "Paiement échoué", unpaid: "Impayé", expired: "Expiré" } as const;
const STATUS_TONE = { trial: "var(--brand-text)", active: "var(--success-text)", past_due: "var(--warning-text)", unpaid: "var(--danger-text)", expired: "var(--danger-text)" } as const;

export function BillingPage({ initialPlan }: { initialPlan?: string }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, ent, billing, actor } = useAppData();
  const [cycle, setCycle] = useState<Cycle>(billing.sub.cycle ?? "monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ plan: PlanId; issues: DowngradeIssue[] } | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[] | null>(null);
  const superAdmin = isSuperAdmin(actor);
  const sub = billing.sub;
  const subscribed = !!sub.plan && billing.source === "server" && (sub.status === "active" || sub.status === "past_due");
  const ready = billingConfigured && !!billing.creds;
  const target = (PLAN_ORDER as string[]).includes(initialPlan ?? "") ? (initialPlan as PlanId) : null;

  useEffect(() => {
    if (!ready || !billing.creds) return;
    billingApi
      .invoices(billing.creds)
      .then((r) => setInvoices(r.invoices))
      .catch(() => setInvoices([]));
  }, [ready, billing.creds]);

  const errorText = (e: unknown) => {
    const code = e instanceof BillingError ? e.code : "";
    return code === "offline" ? t("Serveur d'abonnement injoignable : vérifiez votre connexion Internet.") : code === "payment_not_configured" || code === "price_not_configured" ? t("Le paiement en ligne n'est pas encore configuré.") : t("L'opération n'a pas abouti. Réessayez dans un instant.");
  };

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  /** Souscription (page de paiement Stripe) ou changement de forfait au prorata, après vérification des limites. */
  const choose = (plan: PlanId, checked = false) => {
    if (!billing.creds) return;
    const issues = downgradeIssues(plan, { users: activeUsers(data.members), usedFeatures: featuresInUse(data) });
    if (!checked && issues.length) return setConfirm({ plan, issues });
    setConfirm(null);
    void act(plan, async () => {
      if (subscribed) await billing.applyLicense((await billingApi.change(billing.creds!, plan, cycle)).license);
      else window.location.href = (await billingApi.checkout(billing.creds!, plan, cycle)).url;
    });
  };

  if (!superAdmin)
    return (
      <div>
        <PageHeader title={t("Mon abonnement")} />
        <Notice>{t("L'abonnement est géré par le super admin du compte.")}</Notice>
      </div>
    );

  return (
    <div className="space-y-8">
      <PageHeader title={t("Mon abonnement")} subtitle={t("Devis illimités dans tous les forfaits. Prix hors TVA ; TVA belge de {v} % en plus.", { v: Math.round(VAT_RATE * 100) })} />

      {!billingConfigured && <Notice tone="warn">{t("Le paiement en ligne n'est pas encore configuré : l'abonnement ne peut pas encore être souscrit depuis l'application.")}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {/* forfait actuel et usage */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-6">
          <p className="text-xs uppercase tracking-wider text-slate-500">{t("Forfait actuel")}</p>
          <p className="font-display text-2xl font-bold text-white">
            {ent.status === "trial" ? t("Essai gratuit ({p})", { p: PLANS[TRIAL.plan].name }) : sub.plan ? PLANS[sub.plan].name : "—"}
          </p>
          <p className="text-sm font-semibold" style={{ color: STATUS_TONE[ent.status] }}>
            {t(STATUS_LABEL[ent.status])}
            {sub.cancelAtPeriodEnd && ent.status === "active" && ` · ${t("annulé, accès jusqu'au {d}", { d: f.date((sub.periodEnd ?? "").slice(0, 10)) })}`}
          </p>
          <p className="text-sm text-slate-400">
            {ent.status === "trial"
              ? t("Fin de l'essai : {d}", { d: f.date((sub.trialEndsAt ?? "").slice(0, 10)) })
              : sub.plan && sub.cycle
                ? `${f.money(priceHT(sub.plan, sub.cycle))} ${t("HTVA")} / ${sub.cycle === "monthly" ? t("mois") : t("an")} · ${f.money(priceTTC(sub.plan, sub.cycle))} ${t("TVAC")}${sub.periodEnd ? ` · ${t("prochaine échéance le {d}", { d: f.date(sub.periodEnd.slice(0, 10)) })}` : ""}`
                : ""}
          </p>
          <p className="text-sm text-slate-400">{t("Utilisateurs : {n} / {m}", { n: activeUsers(data.members), m: ent.maxUsers ?? "∞" })}</p>
          {subscribed && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button disabled={!!busy} onClick={() => act("portal", async () => void (window.location.href = (await billingApi.portal(billing.creds!)).url))} className="btn-ghost !py-2 text-sm">
                <CreditCard className="h-4 w-4" /> {t("Moyen de paiement")}
              </button>
              {sub.cancelAtPeriodEnd ? (
                <button disabled={!!busy} onClick={() => act("cancel", async () => billing.applyLicense((await billingApi.cancel(billing.creds!, true)).license))} className="btn-ghost !py-2 text-sm">
                  {t("Reprendre l'abonnement")}
                </button>
              ) : (
                <button
                  disabled={!!busy}
                  onClick={() => window.confirm(t("Annuler l'abonnement ? Vous gardez l'accès jusqu'à la fin de la période payée, puis vos données restent consultables en lecture seule.")) && act("cancel", async () => billing.applyLicense((await billingApi.cancel(billing.creds!)).license))}
                  className="btn-ghost !py-2 text-sm"
                >
                  {t("Annuler l'abonnement")}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="card space-y-4 p-6">
          <UsageMeter />
          <p className="text-xs text-slate-500">
            {ent.overagePrice !== null
              ? t("Au-delà de {q} factures, chaque facture Peppol est facturée {p} € HTVA en fin de période.", { q: ent.invoiceQuota, p: ent.overagePrice.toFixed(2).replace(".", ",") })
              : t("Seules les factures envoyées via Peppol sont comptées ; les devis et les PDF ne le sont jamais. Le compteur repart à zéro à chaque période.")}
          </p>
        </div>
      </section>

      {/* choix du forfait */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-white">{subscribed ? t("Changer de forfait") : t("Choisir un forfait")}</h2>
          <div role="group" aria-label={t("Cycle de facturation")} className="flex rounded-xl border border-white/10 p-1 text-sm font-semibold">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} aria-pressed={cycle === c} className={cn("rounded-lg px-3 py-1.5", cycle === c ? "bg-blue text-white" : "text-slate-400 hover:text-white")}>
                {c === "monthly" ? t("Mensuel") : t("Annuel · {n} mois offerts", { n: YEARLY_FREE_MONTHS })}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const current = subscribed && sub.plan === id && sub.cycle === cycle;
            const featured = (target ?? HIGHLIGHTED_PLAN) === id;
            return (
              <div key={id} className={cn("card flex flex-col gap-3 p-5", featured && "ring-2 ring-[var(--brand)]")}>
                <p className="font-display text-lg font-bold text-white">{p.name}</p>
                <p>
                  <span className="font-display text-3xl font-extrabold tabular-nums text-white">{f.money(monthlyEquivalentHT(id, cycle))}</span>
                  <span className="text-sm text-slate-400"> {t("HTVA / mois")}</span>
                </p>
                <p className="text-xs text-slate-500">{cycle === "yearly" ? t("{a} HTVA facturés par an ({b} TVAC)", { a: f.money(priceHT(id, cycle)), b: f.money(priceTTC(id, cycle)) }) : t("{b} TVAC par mois", { b: f.money(priceTTC(id, cycle)) })}</p>
                <ul className="flex-1 space-y-1.5 text-sm text-slate-300">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-text)]" /> {t("Devis illimités")}</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-text)]" /> {p.overagePrice !== null ? t("{n} factures Peppol / mois, puis {p} € HTVA par facture", { n: p.invoicesPerMonth, p: p.overagePrice.toFixed(2).replace(".", ",") }) : t("{n} factures Peppol / mois", { n: p.invoicesPerMonth })}</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-text)]" /> {p.maxUsers === null ? t("Utilisateurs illimités") : p.maxUsers === 1 ? t("1 utilisateur") : t("Jusqu'à {n} utilisateurs", { n: p.maxUsers })}</li>
                </ul>
                <button disabled={!ready || current || !!busy} onClick={() => choose(id)} className={cn("w-full text-sm disabled:opacity-50", featured ? "btn-primary" : "btn-ghost")}>
                  {busy === id ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? t("Forfait actuel") : subscribed ? t("Passer au forfait {p}", { p: p.name }) : t("Choisir {p}", { p: p.name })}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">{t("Changement de forfait au prorata : une montée est facturée tout de suite pour la période restante, une descente donne un avoir sur la prochaine facture. Aucune donnée n'est jamais supprimée.")}</p>
      </section>

      {/* historique de facturation */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-white">{t("Historique de facturation")}</h2>
        {!ready || invoices === null ? (
          <p className="text-sm text-slate-500">{ready ? t("Chargement…") : t("Aucune facture pour l'instant.")}</p>
        ) : !invoices.length ? (
          <p className="text-sm text-slate-500">{t("Aucune facture pour l'instant.")}</p>
        ) : (
          <div className="card divide-y divide-white/5">
            {invoices.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="flex-1 text-slate-200">{i.number ?? "—"} · {f.date(i.date.slice(0, 10))}</span>
                <span className="tabular-nums text-white">{f.money(i.totalTTC)}</span>
                <span className="text-xs" style={{ color: i.status === "paid" ? "var(--success-text)" : i.status === "open" ? "var(--warning-text)" : "var(--muted)" }}>
                  {i.status === "paid" ? t("Payée") : i.status === "open" ? t("À payer") : i.status}
                </span>
                {(i.pdf || i.url) && (
                  <a href={(i.pdf || i.url)!} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-text)] hover:underline" aria-label={t("Ouvrir la facture")}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {confirm && (
        <Modal title={t("Passer au forfait {p}", { p: PLANS[confirm.plan].name })} onClose={() => setConfirm(null)}>
          <div className="space-y-4 text-sm">
            {confirm.issues.map((i, k) =>
              i.kind === "users" ? (
                <Notice key={k} tone="danger">
                  <Lock className="mr-1 inline h-4 w-4" /> {t("Vous avez {n} utilisateurs actifs ; le forfait {p} en permet {m}. Désactivez des utilisateurs (Équipe) avant de changer de forfait.", { n: i.current, p: PLANS[confirm.plan].name, m: i.max })}
                </Notice>
              ) : null,
            )}
            {confirm.issues.some((i) => i.kind === "feature") && (
              <div>
                <p className="text-slate-300">{t("Ces modules contiennent des données et seront grisés avec ce forfait. Rien n'est supprimé : tout réapparaît si vous revenez à un forfait qui les inclut.")}</p>
                <ul className="mt-2 list-disc pl-5 text-slate-400">
                  {confirm.issues.map((i, k) => (i.kind === "feature" ? <li key={k}>{t(featureLabel(i.feature))}</li> : null))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="btn-ghost text-sm">
                {t("Annuler")}
              </button>
              <button disabled={downgradeBlocked(confirm.issues)} onClick={() => choose(confirm.plan, true)} className="btn-primary text-sm disabled:opacity-40">
                {t("Confirmer")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
