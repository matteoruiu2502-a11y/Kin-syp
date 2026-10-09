"use client";

// Éléments d'interface des forfaits : module grisé « Disponible dans le forfait X », pastille de forfait,
// barre « X / Y factures ce mois-ci » et message quand une action est bloquée par le forfait.

import { Lock, Sparkles, X } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { isSuperAdmin, PERM_LABEL } from "@/lib/app/permissions";
import { PLANS, planFor, type Feature, type PlanId } from "@/lib/plans";
import { usageAlert } from "@/lib/billing/entitlement";
import type { PlanBlock } from "@/lib/billing/guard";
import type { PermModule } from "@/lib/app/types";
import { cn } from "@/lib/utils";

const EXTRA_LABEL: Record<Exclude<Feature, PermModule>, string> = {
  users: "Plusieurs utilisateurs",
  customRoles: "Rôles et accès personnalisés",
  gantt: "Planning Gantt",
  weather: "Calendrier des intempéries",
  materials: "Analyse matériaux prévu / réel",
  subcontractLines: "Sous-traitance ligne par ligne",
  mode3d: "Mode 3D",
};

export const featureLabel = (f: Feature) => (f in EXTRA_LABEL ? EXTRA_LABEL[f as keyof typeof EXTRA_LABEL] : PERM_LABEL[f as PermModule].label);

/** Ouvre la page « Mon abonnement » sur le forfait proposé. */
export const openPlans = (plan?: PlanId) => {
  window.location.hash = `#abonnement${plan ? `/${plan}` : ""}`;
};

/** Petite pastille du forfait requis (dans les menus et onglets). */
export function PlanChip({ plan, className }: { plan: PlanId; className?: string }) {
  return <span className={cn("rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400", className)}>{PLANS[plan].name}</span>;
}

/** Bouton de mise à niveau (le super admin seul gère l'abonnement). */
function UpgradeButton({ plan, className }: { plan: PlanId; className?: string }) {
  const { t } = useTr();
  const { actor } = useAppData();
  if (!isSuperAdmin(actor)) return <p className="text-xs text-slate-500">{t("Demandez au super admin de changer de forfait.")}</p>;
  return (
    <button type="button" onClick={() => openPlans(plan)} className={cn("btn-primary !py-2 text-sm", className)}>
      <Sparkles className="h-4 w-4" /> {t("Passer au forfait {p}", { p: PLANS[plan].name })}
    </button>
  );
}

/** Module ou fonction hors forfait : grisé, jamais caché, avec la mise à niveau proposée. */
export function PlanGate({ feature, className }: { feature: Feature; className?: string }) {
  const { t } = useTr();
  const plan = planFor(feature);
  return (
    <div className={cn("card flex flex-col items-center gap-3 p-8 text-center", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400">
        <Lock className="h-5 w-5" />
      </span>
      <p className="font-display text-lg font-bold text-white">{t(featureLabel(feature))}</p>
      <p className="max-w-md text-sm text-slate-400">{t("Disponible dans le forfait {p}. Vos données sont conservées : elles réapparaissent dès que le forfait le permet.", { p: PLANS[plan].name })}</p>
      <UpgradeButton plan={plan} />
    </div>
  );
}

/** Barre « X / Y factures ce mois-ci » (couleur : ok, attention à 80 %, alerte à 100 %). */
export function UsageMeter({ className }: { className?: string }) {
  const { t } = useTr();
  const { ent, billing } = useAppData();
  const { used } = billing;
  const quota = ent.invoiceQuota;
  const alert = usageAlert(ent, used);
  const pct = Math.min(100, quota ? (used / quota) * 100 : 100);
  const color = alert === 100 ? "var(--danger)" : alert === 80 ? "var(--warning)" : "var(--success)";
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-300">{ent.status === "trial" ? t("Factures Peppol pendant l'essai") : t("Factures Peppol ce mois-ci")}</span>
        <span className="font-semibold tabular-nums text-white">
          {used} / {quota}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={quota} aria-valuenow={used} aria-label={t("Factures Peppol ce mois-ci")}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {alert && <UsageAlertText />}
    </div>
  );
}

/** Message d'alerte à 80 % puis 100 % du quota. */
export function UsageAlertText() {
  const { t } = useTr();
  const { ent, billing } = useAppData();
  const alert = usageAlert(ent, billing.used);
  if (!alert) return null;
  const next = ent.status === "trial" ? null : ent.plan === "starter" ? "pro" : ent.plan === "pro" ? "max" : null;
  const text =
    alert === 100
      ? ent.overagePrice !== null
        ? t("Quota atteint : chaque facture Peppol en plus est facturée {p} € HTVA en fin de période.", { p: ent.overagePrice.toFixed(2).replace(".", ",") })
        : ent.status === "trial"
          ? t("Quota de l'essai atteint : choisissez un forfait pour envoyer d'autres factures via Peppol.")
          : t("Quota atteint : plus d'envoi Peppol possible ce mois-ci avec votre forfait.")
      : t("Vous avez utilisé 80 % de vos factures Peppol de la période.");
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: alert === 100 ? "var(--danger-text)" : "var(--warning-text)" }}>
      {text}
      {next && alert === 100 && ent.overagePrice === null && (
        <button type="button" onClick={() => openPlans(next)} className="font-semibold underline">
          {t("Passer au forfait {p}", { p: PLANS[next].name })}
        </button>
      )}
    </p>
  );
}

/** Message affiché quand une action est refusée par le forfait. */
export function PlanBlockToast({ block, onClose }: { block: PlanBlock; onClose: () => void }) {
  const { t } = useTr();
  const text =
    block.kind === "readonly"
      ? t("Lecture seule : votre essai est terminé ou votre abonnement est impayé. Vos données sont conservées.")
      : block.kind === "users"
        ? t("Votre forfait est limité à {n} utilisateur(s). Désactivez un utilisateur ou passez au forfait supérieur.", { n: block.max })
        : t("« {f} » est disponible dans le forfait {p}.", { f: t(featureLabel(block.feature)), p: PLANS[block.plan].name });
  const plan: PlanId | undefined = block.kind === "feature" ? block.plan : block.kind === "users" ? (block.max < (PLANS.pro.maxUsers ?? Infinity) ? "pro" : "max") : undefined;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-ink p-4 text-sm shadow-2xl md:bottom-6">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="flex-1 space-y-2">
        <p className="text-slate-200">{text}</p>
        <button type="button" onClick={() => (openPlans(plan), onClose())} className="text-sm font-semibold text-cyan hover:underline">
          {t("Voir les forfaits")}
        </button>
      </div>
      <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label={t("Fermer")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
