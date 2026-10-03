import { describe, expect, it } from "vitest";
import { emptyAccountData } from "./defaults";
import { attestationState, recordRetentionCheck, subcontractorAlerts, subcontractorSummary } from "./subcontractors";
import type { AccountData } from "./types";

const data = (): AccountData => ({
  ...emptyAccountData("a"),
  suppliers: [{ id: "s", kind: "subcontractor", name: "Élec", bce: "", email: "", phone: "", address: { street: "", postcode: "", city: "", country: "BE" }, trade: "", importMapping: null, notes: "", attestations: [{ id: "a", kind: "insurance_rc", reference: "", validUntil: "2026-10-10", fileId: null }] }],
  purchases: [{ id: "p", type: "invoice", supplierId: "s", jobId: null, number: "E1", date: "2026-09-01", dueDate: "2026-10-01", lines: [{ id: "l", articleId: null, label: "x", qty: 1, unitPrice: 1000, vat: 0 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null }],
});

describe("sous-traitants", () => {
  it("états des attestations", () => {
    expect(attestationState(undefined)).toBe("missing");
    expect(attestationState({ id: "", kind: "onss", reference: "", validUntil: "2026-09-01", fileId: null }, "2026-10-03")).toBe("expired");
    expect(attestationState({ id: "", kind: "onss", reference: "", validUntil: "2026-10-20", fileId: null }, "2026-10-03")).toBe("expiring");
  });
  it("alertes : attestations manquantes et retenue non vérifiée", () => {
    const a = subcontractorAlerts(data(), "2026-10-03");
    expect(a.some((x) => x.text.includes("ONSS") && x.text.includes("manquante"))).toBe(true);
    expect(a.some((x) => x.text.includes("expire bientôt"))).toBe(true);
    expect(a.some((x) => x.purchaseId === "p" && x.level === "danger")).toBe(true);
  });
  it("consultation 30bis appliquée aux factures non payées : 35 % ONSS", () => {
    const d = recordRetentionCheck(data(), "s", { checkedAt: "2026-09-15", taxDebt: false, onssDebt: true, inastiDebt: false, attestationId: "REF" });
    expect(d.purchases[0].retention?.onssDebt).toBe(true);
    expect(subcontractorSummary(d, "s").retentionOnss).toBe(350);
  });
});
