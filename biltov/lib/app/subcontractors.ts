// Sous-traitants : attestations (assurances, ONSS, fiscale), obligation de retenue (art. 30bis loi ONSS,
// art. 403 CIR 92) et alertes avant paiement.

import { addDays, todayIso } from "./defaults";
import { purchaseTotals, retentionFor } from "./finance";
import type { AccountData, Attestation, AttestationKind, RetentionCheck, Supplier } from "./types";

export const ATTESTATION_LABEL: Record<AttestationKind, string> = {
  insurance_rc: "Assurance RC professionnelle",
  insurance_decennial: "Assurance décennale",
  onss: "Attestation ONSS (absence de dettes sociales)",
  tax: "Attestation SPF Finances (absence de dettes fiscales)",
  registration: "Accès à la profession / enregistrement",
  other: "Autre document",
};

/** Attestations attendues pour un sous-traitant de la construction. */
export const REQUIRED_ATTESTATIONS: AttestationKind[] = ["insurance_rc", "onss", "tax"];

export type AttestationState = "valid" | "expiring" | "expired" | "missing";

export function attestationState(a: Attestation | undefined, today = todayIso()): AttestationState {
  if (!a) return "missing";
  if (!a.validUntil) return "valid";
  if (a.validUntil < today) return "expired";
  if (a.validUntil <= addDays(today, 30)) return "expiring";
  return "valid";
}

/** Dernière consultation de l'obligation de retenue. */
export const lastCheck = (s: Supplier): RetentionCheck | null => [...(s.retentionChecks ?? [])].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0] ?? null;

export type SubAlert = { supplierId: string; level: "danger" | "warn"; text: string; issue: "missing" | "expired" | "expiring" | "unchecked" | "stale"; kind?: AttestationKind; number?: string; date?: string; purchaseId?: string };

export function subcontractorAlerts(d: AccountData, today = todayIso()): SubAlert[] {
  const out: SubAlert[] = [];
  for (const s of d.suppliers.filter((x) => x.kind === "subcontractor")) {
    for (const kind of REQUIRED_ATTESTATIONS) {
      const st = attestationState((s.attestations ?? []).filter((a) => a.kind === kind).sort((a, b) => (b.validUntil ?? "9").localeCompare(a.validUntil ?? "9"))[0], today);
      if (st === "missing") out.push({ supplierId: s.id, level: "warn", issue: "missing", kind, text: `${ATTESTATION_LABEL[kind]} manquante` });
      if (st === "expired") out.push({ supplierId: s.id, level: "danger", issue: "expired", kind, text: `${ATTESTATION_LABEL[kind]} expirée` });
      if (st === "expiring") out.push({ supplierId: s.id, level: "warn", issue: "expiring", kind, text: `${ATTESTATION_LABEL[kind]} expire bientôt` });
    }
    for (const p of d.purchases.filter((x) => x.supplierId === s.id && x.type === "invoice" && x.status !== "paid")) {
      if (!p.retention) out.push({ supplierId: s.id, level: "danger", issue: "unchecked", number: p.number, purchaseId: p.id, text: `Facture ${p.number || "—"} : obligation de retenue non vérifiée avant paiement` });
      else if (p.retention.checkedAt < addDays(today, -7)) out.push({ supplierId: s.id, level: "warn", issue: "stale", number: p.number, date: p.retention.checkedAt, purchaseId: p.id, text: `Facture ${p.number || "—"} : vérification de la retenue datée du ${p.retention.checkedAt}, à refaire le jour du paiement` });
    }
  }
  return out;
}

/** Enregistre une consultation et l'applique aux factures non payées du sous-traitant. */
export function recordRetentionCheck(d: AccountData, supplierId: string, check: RetentionCheck): AccountData {
  return {
    ...d,
    suppliers: d.suppliers.map((s) => (s.id === supplierId ? { ...s, retentionChecks: [...(s.retentionChecks ?? []), check] } : s)),
    purchases: d.purchases.map((p) => (p.supplierId === supplierId && p.type === "invoice" && p.status !== "paid" ? { ...p, retention: check } : p)),
  };
}

/** Synthèse par sous-traitant : facturé, à payer, retenues à verser. */
export function subcontractorSummary(d: AccountData, supplierId: string) {
  const inv = d.purchases.filter((p) => p.supplierId === supplierId && p.type === "invoice");
  const unpaid = inv.filter((p) => p.status !== "paid");
  const ret = unpaid.map((p) => retentionFor(purchaseTotals(p).ht, p.retention, todayIso()));
  return {
    invoiced: inv.reduce((s, p) => s + purchaseTotals(p).ht, 0),
    toPay: unpaid.reduce((s, p) => s + purchaseTotals(p).ttc, 0),
    retentionOnss: ret.reduce((s, r) => s + r.onss, 0),
    retentionTax: ret.reduce((s, r) => s + r.tax + r.inasti, 0),
    unpaid: unpaid.length,
  };
}
