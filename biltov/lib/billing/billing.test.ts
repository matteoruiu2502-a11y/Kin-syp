import { describe, expect, it } from "vitest";
import { PEPPOL_COST_ESTIMATE, PLANS, PLAN_ORDER, TRIAL, VAT_RATE, YEARLY_FREE_MONTHS, monthlyEquivalentHT, planFor, priceHT, priceTTC } from "../plans";
import { activeUsers, canAccess, canAddUser, canSendInvoice, capPermissions, downgradeBlocked, downgradeIssues, effectiveStatus, entitlementOf, featuresInUse, overageCount, recordSend, trialSubscription, usageAlert, usagePeriod, usedInPeriod, type Subscription } from "./entitlement";
import { emptyAccountData } from "../app/defaults";
import { permissionsOf } from "../app/permissions";

const T0 = Date.parse("2026-10-01T09:00:00Z");
const DAY = 864e5;
const paid = (plan: Subscription["plan"], p: Partial<Subscription> = {}): Subscription => ({ plan, status: "active", cycle: "monthly", startedAt: "2026-10-01T09:00:00.000Z", trialEndsAt: null, periodStart: "2026-10-01T09:00:00.000Z", periodEnd: "2026-11-01T09:00:00.000Z", graceUntil: null, cancelAtPeriodEnd: false, ...p });

describe("configuration des forfaits", () => {
  it("le coût maximal d'un client reste toujours sous son abonnement (marge garantie)", () => {
    for (const id of PLAN_ORDER) {
      const p = PLANS[id];
      const maxCost = p.invoicesPerMonth * PEPPOL_COST_ESTIMATE;
      expect(maxCost).toBeLessThan(p.monthly);
      expect(maxCost).toBeLessThan(monthlyEquivalentHT(id, "yearly"));
      // au-delà du quota : chaque facture rapporte plus qu'elle ne coûte, ou l'envoi est bloqué
      if (p.overagePrice !== null) expect(p.overagePrice).toBeGreaterThan(PEPPOL_COST_ESTIMATE);
    }
    expect(TRIAL.peppolInvoices * PEPPOL_COST_ESTIMATE).toBeLessThanOrEqual(1.25);
  });

  it("prix : annuel = 2 mois offerts, TVA belge 21 % ajoutée", () => {
    expect(priceHT("pro", "monthly")).toBe(59);
    expect(priceHT("pro", "yearly")).toBe(59 * (12 - YEARLY_FREE_MONTHS));
    expect(priceTTC("starter", "monthly")).toBe(Math.round(29 * (1 + VAT_RATE) * 100) / 100);
    expect(monthlyEquivalentHT("max", "yearly")).toBe(82.5);
  });

  it("chaque forfait contient le précédent ; devis et factures partout", () => {
    expect(PLANS.starter.features.every((f) => PLANS.pro.features.includes(f))).toBe(true);
    expect(PLANS.pro.features.every((f) => PLANS.max.features.includes(f))).toBe(true);
    for (const id of PLAN_ORDER) expect(PLANS[id].features).toEqual(expect.arrayContaining(["quotes", "invoices"]));
  });
});

describe("accès aux modules par forfait", () => {
  const ent = (plan: "starter" | "pro" | "max") => entitlementOf(paid(plan), T0 + DAY);
  it("Starter : devis et factures, pas de stock ni d'équipe", () => {
    expect(canAccess(ent("starter"), "quotes")).toBe(true);
    expect(canAccess(ent("starter"), "stock")).toBe(false);
    expect(canAccess(ent("starter"), "users")).toBe(false);
  });
  it("Pro : stock et utilisateurs, pas de pointage, de Gantt, de rôles personnalisés ni de 3D", () => {
    for (const f of ["stock", "users", "purchases"] as const) expect(canAccess(ent("pro"), f)).toBe(true);
    for (const f of ["time", "worker", "team", "gantt", "weather", "materials", "subcontractLines", "customRoles", "mode3d"] as const) expect(canAccess(ent("pro"), f)).toBe(false);
  });
  it("Max : tout", () => {
    for (const f of ["time", "worker", "gantt", "weather", "customRoles", "mode3d", "subcontractors"] as const) expect(canAccess(ent("max"), f)).toBe(true);
  });
  it("forfait à proposer pour débloquer un module", () => {
    expect(planFor("stock")).toBe("pro");
    expect(planFor("mode3d")).toBe("max");
    expect(planFor("quotes")).toBe("starter");
  });
  it("les droits du rôle sont limités par le forfait (super admin compris)", () => {
    const p = capPermissions(permissionsOf({}, null), ent("starter"));
    expect(p.quotes).toBe("edit");
    expect(p.stock).toBe("none");
    expect(p.time).toBe("none");
  });
});

describe("essai gratuit", () => {
  const sub = trialSubscription(new Date(T0).toISOString());
  it("5 jours avec tout le Max, mais 5 factures Peppol seulement", () => {
    const e = entitlementOf(sub, T0 + 2 * DAY);
    expect(e.status).toBe("trial");
    expect(e.plan).toBe("max");
    expect(canAccess(e, "mode3d")).toBe(true);
    expect(e.invoiceQuota).toBe(TRIAL.peppolInvoices);
    expect(e.overagePrice).toBeNull();
    expect(e.daysLeft).toBe(3);
    expect(canSendInvoice(e, 5)).toEqual({ ok: false, reason: "quota", upgrade: null });
  });
  it("à la fin : lecture seule, sans perte de données", () => {
    const e = entitlementOf(sub, T0 + TRIAL.days * DAY + 1000);
    expect(e.status).toBe("expired");
    expect(e.readOnly).toBe(true);
    const p = capPermissions(permissionsOf({}, null), e);
    expect(p.quotes).toBe("read");
    expect(p.invoices).toBe("read");
    expect(canSendInvoice(e, 0)).toMatchObject({ ok: false, reason: "readonly" });
  });
});

describe("compteur de factures Peppol", () => {
  it("compte les envois réussis et repart à zéro à chaque période", () => {
    const sub = paid("starter");
    const p1 = usagePeriod(sub, T0 + 10 * DAY);
    let u = recordSend(null, p1);
    u = recordSend(u, p1);
    expect(usedInPeriod(u, p1)).toBe(2);
    const p2 = usagePeriod(sub, T0 + 40 * DAY);
    expect(p2.start).toBe("2026-11-01T09:00:00.000Z");
    expect(usedInPeriod(u, p2)).toBe(0);
    expect(recordSend(u, p2)).toEqual({ periodStart: p2.start, peppol: 1 });
  });
  it("forfait annuel : le quota reste mensuel", () => {
    const sub = paid("pro", { cycle: "yearly", periodEnd: "2027-10-01T09:00:00.000Z" });
    expect(usagePeriod(sub, Date.parse("2027-03-15T00:00:00Z"))).toEqual({ start: "2027-03-01T09:00:00.000Z", end: "2027-04-01T09:00:00.000Z" });
  });
  it("période d'un abonnement démarré le 31 : fin de mois respectée", () => {
    const sub = paid("pro", { periodStart: "2026-01-31T00:00:00.000Z" });
    expect(usagePeriod(sub, Date.parse("2026-02-15T00:00:00Z"))).toEqual({ start: "2026-01-31T00:00:00.000Z", end: "2026-02-28T00:00:00.000Z" });
  });
});

describe("blocage au quota", () => {
  it("Starter et Pro : bloqué au quota, avec le forfait supérieur proposé", () => {
    const s = entitlementOf(paid("starter"), T0 + DAY);
    expect(canSendInvoice(s, 29)).toEqual({ ok: true, overage: false });
    expect(canSendInvoice(s, 30)).toEqual({ ok: false, reason: "quota", upgrade: "pro" });
    expect(canSendInvoice(entitlementOf(paid("pro"), T0 + DAY), 100)).toEqual({ ok: false, reason: "quota", upgrade: "max" });
  });
  it("Max : dépassement autorisé et compté", () => {
    const m = entitlementOf(paid("max"), T0 + DAY);
    expect(canSendInvoice(m, 300)).toEqual({ ok: true, overage: true });
    expect(overageCount(m, 312)).toBe(12);
    expect(overageCount(entitlementOf(paid("pro"), T0 + DAY), 120)).toBe(0);
  });
  it("alertes à 80 % puis 100 %", () => {
    const pro = entitlementOf(paid("pro"), T0 + DAY);
    expect(usageAlert(pro, 79)).toBeNull();
    expect(usageAlert(pro, 80)).toBe(80);
    expect(usageAlert(pro, 100)).toBe(100);
  });
});

describe("utilisateurs", () => {
  it("le titulaire compte pour un ; limite par forfait", () => {
    const members = [{ role: "owner", active: true }, { role: "secretary", active: true }, { role: "worker", active: false }];
    expect(activeUsers(members)).toBe(2);
    expect(canAddUser(entitlementOf(paid("starter"), T0), 1)).toBe(false);
    expect(canAddUser(entitlementOf(paid("pro"), T0), 4)).toBe(true);
    expect(canAddUser(entitlementOf(paid("pro"), T0), 5)).toBe(false);
    expect(canAddUser(entitlementOf(paid("max"), T0), 500)).toBe(true);
  });
});

describe("paiement et changement de forfait", () => {
  it("paiement échoué : délai de grâce, puis lecture seule", () => {
    const sub = paid("pro", { status: "past_due", graceUntil: new Date(T0 + 7 * DAY).toISOString() });
    expect(entitlementOf(sub, T0 + 3 * DAY)).toMatchObject({ status: "past_due", readOnly: false, daysLeft: 4 });
    expect(entitlementOf(sub, T0 + 8 * DAY)).toMatchObject({ status: "unpaid", readOnly: true });
  });
  it("résiliation : accès jusqu'à la fin de la période payée", () => {
    const sub = paid("pro", { cancelAtPeriodEnd: true });
    expect(effectiveStatus(sub, T0 + 10 * DAY)).toBe("active");
    expect(effectiveStatus(sub, T0 + 40 * DAY)).toBe("expired");
  });
  it("passage à un forfait inférieur : prévenir, bloquer tant qu'il y a trop d'utilisateurs", () => {
    const issues = downgradeIssues("starter", { users: 3, usedFeatures: ["stock", "quotes"] });
    expect(issues).toEqual([{ kind: "users", current: 3, max: 1 }, { kind: "feature", feature: "stock" }]);
    expect(downgradeBlocked(issues)).toBe(true);
    expect(downgradeBlocked(downgradeIssues("pro", { users: 3, usedFeatures: ["time"] }))).toBe(false);
    expect(downgradeIssues("max", { users: 40, usedFeatures: ["time", "gantt"] })).toEqual([]);
  });
  it("mise à niveau : les nouveaux modules sont accessibles immédiatement", () => {
    expect(canAccess(entitlementOf(paid("starter"), T0), "stock")).toBe(false);
    expect(canAccess(entitlementOf(paid("pro"), T0), "stock")).toBe(true);
  });
  it("modules utilisés détectés à partir des données", () => {
    const d = emptyAccountData("");
    expect(featuresInUse(d)).toEqual([]);
    d.stockMoves = [{} as never];
    d.members = [{ role: "worker", active: true } as never];
    expect(featuresInUse(d)).toEqual(["users", "stock", "worker"]);
  });
});
