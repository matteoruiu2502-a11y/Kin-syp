import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newDoc, newJob, newLine } from "./defaults";
import { executionBreakdown, lineMargin, priceFromCost, quoteByExecution, subcontractorUsage, withCost, withExecution, withMargin, withPrice } from "./execution";
import { jobProfit } from "./profit";
import type { AccountData, Supplier } from "./types";

const sub = (id: string, name: string, marginPercent?: number): Supplier => ({ id, kind: "subcontractor", name, bce: "", email: "", phone: "", address: { street: "", postcode: "", city: "", country: "BE" }, trade: "", importMapping: null, notes: "", marginPercent });

describe("exécution et marge par ligne", () => {
  const d = { ...emptyAccountData("a"), suppliers: [sub("elec", "Élec", 12), sub("toit", "Toiture")] };

  it("prix de vente = coût × (1 + marge)", () => {
    expect(priceFromCost(100, 30)).toBe(130);
    const l = withMargin(newLine({ costPrice: 80 }), 25);
    expect(l.unitPrice).toBe(100);
    expect(lineMargin(l)).toBe(25);
  });

  it("marge par défaut selon l'exécutant", () => {
    const l = newLine({ costPrice: 100, unitPrice: 0 });
    expect(withExecution(d, l, null)).toMatchObject({ executedBy: null, marginPercent: 30, unitPrice: 130 });
    expect(withExecution(d, l, "elec")).toMatchObject({ executedBy: "elec", marginPercent: 12, unitPrice: 112 });
    expect(withExecution(d, l, "toit")).toMatchObject({ marginPercent: 15, unitPrice: 115 });
  });

  it("le coût change, la marge reste ; le prix change, la marge suit", () => {
    const l = withMargin(newLine({ costPrice: 100 }), 20);
    expect(withCost(d, l, 200)).toMatchObject({ unitPrice: 240, marginPercent: 20 });
    expect(withPrice(l, 150).marginPercent).toBe(50);
    // ligne sans marge enregistrée : déduite du prix
    expect(lineMargin(newLine({ costPrice: 50, unitPrice: 75 }))).toBe(50);
    expect(lineMargin(newLine({ costPrice: 0, unitPrice: 75 }))).toBeNull();
  });

  it("rentabilité ventilée : nous / chaque sous-traitant / totaux", () => {
    const base: AccountData = { ...d, clients: [newClient({ id: "c" })], jobs: [newJob({ id: "j", clientId: "c" })] };
    const data: AccountData = {
      ...base,
      members: [{ id: "m", name: "K", role: "worker", phone: "", email: "", lang: "fr", hourlyCost: 40, color: "", pin: "", active: true }],
      suppliers: [...base.suppliers, { ...sub("neg", "Négoce"), kind: "supplier" }],
      docs: [
        {
          ...newDoc({ jobId: "j", clientId: "c", type: "quote" }),
          status: "accepted",
          globalDiscountPercent: 10,
          lines: [
            newLine({ qty: 10, unitPrice: 50, costPrice: 30 }), // nous : 500 vendu, 300 prévu
            newLine({ qty: 1, unitPrice: 1000, costPrice: 800, executedBy: "elec" }),
            newLine({ qty: 2, unitPrice: 300, costPrice: 250, executedBy: "toit" }),
            newLine({ qty: 1, unitPrice: 999, costPrice: 1, optional: true, selected: false, executedBy: "elec" }), // option non retenue
          ],
        },
      ],
      purchases: [
        { id: "p1", type: "invoice", supplierId: "elec", jobId: "j", number: "1", date: "2026-09-01", dueDate: "2026-10-01", lines: [{ id: "l", articleId: null, label: "x", qty: 1, unitPrice: 850, vat: 0 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null },
        { id: "p2", type: "invoice", supplierId: "neg", jobId: "j", number: "2", date: "2026-09-01", dueDate: "2026-10-01", lines: [{ id: "l", articleId: null, label: "y", qty: 1, unitPrice: 100, vat: 21 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null },
      ],
      timeEntries: [{ id: "t", memberId: "m", jobId: "j", date: "2026-09-01", start: "08:00", end: "13:00", hours: 5, note: "" }],
    };
    const b = executionBreakdown(data, "j");
    expect(b.own).toMatchObject({ revenue: 450, plannedCost: 300, actualCost: 300, actualMargin: 150 });
    const elec = b.subcontractors.find((r) => r.key === "elec")!;
    expect(elec).toMatchObject({ name: "Élec", lines: 1, revenue: 900, plannedCost: 800, actualCost: 850, plannedMargin: 100, actualMargin: 50 });
    const toit = b.subcontractors.find((r) => r.key === "toit")!;
    expect(toit).toMatchObject({ revenue: 540, plannedCost: 500, actualCost: 0 });
    expect(b.subTotal).toMatchObject({ revenue: 1440, plannedCost: 1300, actualCost: 850 });
    expect(b.total).toMatchObject({ revenue: 1890, plannedCost: 1600, actualCost: 1150, actualMargin: 740 });
    // la rentabilité par poste range les lignes sous-traitées en sous-traitance
    expect(jobProfit(data, "j").rows.find((r) => r.post === "subcontracting")!.planned).toBe(1300);
    expect(quoteByExecution(data.docs[0].lines, 10).find((x) => x.key === "elec")).toMatchObject({ revenue: 900, cost: 800 });
    expect(subcontractorUsage(data, "elec")).toMatchObject({ lines: 2, docs: 1, purchases: 1 });
  });
});
