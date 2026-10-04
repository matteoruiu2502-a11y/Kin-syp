import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newDoc, newJob, newLine } from "./defaults";
import { UNLINKED, closestPlanned, materialComparison, normalizeLabel, similarity } from "./materials";
import type { AccountData, Purchase } from "./types";

const inv = (id: string, lines: [string, number, number][], type: Purchase["type"] = "invoice", supplierId = "neg"): Purchase => ({ id, type, supplierId, jobId: "j", number: id, date: "2026-09-01", dueDate: "2026-10-01", lines: lines.map(([label, qty, unitPrice], i) => ({ id: `${id}${i}`, articleId: null, label, qty, unitPrice, vat: 21 })), status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null });

const setup = (purchases: Purchase[]): AccountData => {
  const d = emptyAccountData("a");
  return {
    ...d,
    clients: [newClient({ id: "c" })],
    jobs: [newJob({ id: "j", clientId: "c" })],
    suppliers: [
      { id: "neg", kind: "supplier", name: "Négoce", bce: "", email: "", phone: "", address: { street: "", postcode: "", city: "", country: "BE" }, trade: "", importMapping: null, notes: "" },
      { id: "st", kind: "subcontractor", name: "Élec", bce: "", email: "", phone: "", address: { street: "", postcode: "", city: "", country: "BE" }, trade: "", importMapping: null, notes: "" },
    ],
    docs: [
      {
        ...newDoc({ jobId: "j", clientId: "c", type: "quote" }),
        id: "q",
        status: "accepted",
        lines: [
          newLine({ label: "Carrelage 60x60 gris", qty: 20, unit: "m²", costPrice: 25, category: "installed_material" }),
          newLine({ label: "carrelage  60X60 Gris", qty: 5, unit: "m²", costPrice: 25, category: "installed_material" }), // même description
          newLine({ label: "Colle flexible C2", qty: 10, unit: "sac", costPrice: 12, category: "installed_material" }),
          newLine({ label: "Joint époxy", qty: 4, unit: "kg", costPrice: 15, category: "installed_material" }),
          newLine({ label: "Pose carrelage", qty: 8, unit: "h", costPrice: 40, category: "labour" }), // main-d'œuvre : exclue
          newLine({ label: "Électricité", qty: 1, unit: "forfait", costPrice: 500, category: "installed_material", executedBy: "st" }), // sous-traitée : exclue
        ],
      },
    ],
    purchases,
  };
};

describe("analyse matériaux prévu / réel", () => {
  it("normalise les descriptions", () => {
    expect(normalizeLabel("  Carrelages 60X60  Gris ")).toBe(normalizeLabel("carrelage 60x60 gris"));
    expect(normalizeLabel("Colle époxy")).toBe("colle epoxy");
    expect(similarity("colle flexible c2", "colle flexibel c2")).toBeGreaterThan(0.82);
    expect(similarity("colle flexible c2", "joint epoxy")).toBeLessThan(0.3);
    expect(normalizeLabel("Joint gris 5kg")).toBe(normalizeLabel("joint gris 5 KG"));
    expect(similarity(normalizeLabel("Mortier joint gris 5kg"), normalizeLabel("Joint gris 5 kg"))).toBeGreaterThan(0.82);
    expect(similarity(normalizeLabel("Silicone sanitaire blanc"), normalizeLabel("Colle carrelage C2 25 kg"))).toBeLessThan(0.5);
  });

  it("regroupe, compare, détecte dépassements et économies", () => {
    const d = setup([
      inv("F1", [["CARRELAGE 60x60 gris", 22, 26], ["Colle flexibel C2", 8, 12]]), // faute de frappe
      inv("F2", [["Carrelage 60 x 60 gris", 6, 26]]), // espaces différents → même description
      inv("F3", [["Silicone sanitaire", 3, 7]]), // non prévu
      inv("ST", [["Électricité", 1, 520]], "invoice", "st"), // sous-traitant : hors matériaux
    ]);
    const c = materialComparison(d, "j", { quoteIds: ["q"], sources: ["invoices"] });
    const tile = c.rows.find((r) => r.label === "Carrelage 60x60 gris")!;
    expect(tile.plannedLabels).toHaveLength(2);
    expect(tile).toMatchObject({ plannedQty: 25, actualQty: 28, qtyGap: 3, qtyGapPercent: 12, plannedCost: 625, actualCost: 728, status: "over" });
    expect(tile.actual.map((a) => a.match).sort()).toEqual(["exact", "exact"]); // « 60 x 60 » ≡ « 60x60 »
    const glue = c.rows.find((r) => r.label === "Colle flexible C2")!;
    expect(glue).toMatchObject({ plannedQty: 10, actualQty: 8, qtyGap: -2, qtyGapPercent: -20, status: "under" });
    expect(c.rows.find((r) => r.label === "Joint époxy")!.status).toBe("not_bought");
    expect(c.rows.some((r) => /pose|lectricit/i.test(r.label))).toBe(false);
    expect(c.unplanned.map((r) => r.label)).toEqual(["Silicone sanitaire"]);
    expect(c.overCount).toBe(2);
    expect(c.underCount).toBe(1);
  });

  it("association et dissociation manuelles", () => {
    const d = setup([inv("F1", [["Mortier-colle gris 25kg", 10, 12], ["Carrelage 60x60 gris", 25, 25]])]);
    const auto = materialComparison(d, "j", { quoteIds: ["q"], sources: ["invoices"] });
    expect(auto.unplanned.map((r) => r.key)).toEqual(["mortier colle gri 25 kg"]);
    expect(closestPlanned("mortier colle gri 25 kg", auto.rows.map((r) => r.key))[0].key).toBe("colle flexible c 2");
    const linked = materialComparison(d, "j", { quoteIds: ["q"], sources: ["invoices"], links: { "mortier colle gri 25 kg": "colle flexible c 2", "carrelage 60 x 60 gri": UNLINKED } });
    expect(linked.rows.find((r) => r.key === "colle flexible c 2")).toMatchObject({ actualQty: 10, status: "equal" });
    expect(linked.rows.find((r) => r.key === "colle flexible c 2")!.actual[0].match).toBe("manual");
    expect(linked.unplanned.map((r) => r.label)).toEqual(["Carrelage 60x60 gris"]);
  });

  it("sources : bons de livraison et sorties de stock", () => {
    const d = setup([inv("BL1", [["Joint epoxy", 4, 15]], "delivery")]);
    expect(materialComparison(d, "j", { quoteIds: ["q"], sources: ["invoices"] }).rows.find((r) => r.label === "Joint époxy")!.actualQty).toBe(0);
    expect(materialComparison(d, "j", { quoteIds: ["q"], sources: ["deliveries"] }).rows.find((r) => r.label === "Joint époxy")).toMatchObject({ actualQty: 4, status: "equal" });
  });
});

describe("ouvrages composés", () => {
  it("le devis d'un ouvrage est déplié en fournitures", async () => {
    const { newArticle } = await import("./defaults");
    const tile = newArticle({ id: "fa", name: { fr: "Faïence 30x60", nl: "", de: "" }, unit: "m²", purchasePrice: 24 });
    const mo = newArticle({ id: "mo", type: "labour", unit: "h", purchasePrice: 36 });
    const pack = newArticle({ id: "pk", type: "package", unit: "m²", components: [{ articleId: "fa", qty: 1.1 }, { articleId: "mo", qty: 0.8 }] });
    const d = setup([inv("F", [["Faïence 30x60", 20, 24]])]);
    d.articles = [tile, mo, pack];
    d.docs[0].lines = [newLine({ label: "Pose faïence (ouvrage)", articleId: "pk", qty: 18, unit: "m²", category: "installed_material" })];
    const c = materialComparison(d, "j", { quoteIds: ["q"], sources: ["invoices"] });
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0]).toMatchObject({ label: "Faïence 30x60", plannedQty: 19.8, actualQty: 20, plannedCost: 475.2, status: "over" });
  });
});
