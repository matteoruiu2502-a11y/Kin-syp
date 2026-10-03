import { describe, expect, it } from "vitest";
import { emptyAccountData, newArticle, newClient, newDoc, newJob, newLine } from "./defaults";
import { jobProfit } from "./profit";
import type { AccountData } from "./types";

describe("rentabilité chantier", () => {
  it("vendu, avenants, coûts par poste, marges", () => {
    const sub = newArticle({ id: "st", type: "subcontract" });
    let d: AccountData = { ...emptyAccountData("a"), articles: [sub], clients: [newClient({ id: "c", kind: "assujetti" })], jobs: [newJob({ id: "j", clientId: "c" })] };
    d = {
      ...d,
      members: [{ id: "m", name: "K", role: "worker", phone: "", email: "", lang: "fr", hourlyCost: 40, color: "", pin: "", active: true }],
      suppliers: [{ id: "s", kind: "subcontractor", name: "Élec", bce: "", email: "", phone: "", address: { street: "", postcode: "", city: "", country: "BE" }, trade: "", importMapping: null, notes: "" }],
      docs: [
        { ...newDoc({ jobId: "j", clientId: "c", type: "quote" }), status: "accepted", lines: [newLine({ qty: 10, unitPrice: 100, costPrice: 60, category: "installed_material" }), newLine({ qty: 10, unitPrice: 50, costPrice: 40, category: "labour" }), newLine({ qty: 1, unitPrice: 800, costPrice: 600, articleId: "st" })] },
        { ...newDoc({ jobId: "j", clientId: "c", type: "quote" }), status: "accepted", isAmendment: true, lines: [newLine({ qty: 1, unitPrice: 200, costPrice: 100, category: "installed_material" })] },
      ],
      purchases: [{ id: "p", type: "invoice", supplierId: "s", jobId: "j", number: "1", date: "2026-09-01", dueDate: "2026-10-01", lines: [{ id: "l", articleId: null, label: "x", qty: 1, unitPrice: 650, vat: 0 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null }],
      timeEntries: [{ id: "t", memberId: "m", jobId: "j", date: "2026-09-01", start: "08:00", end: "16:00", hours: 8, note: "" }],
      expenses: [{ id: "e", jobId: "j", memberId: null, date: "2026-09-01", supplier: "", label: "", amountTTC: 121, vat: 21, receiptId: null, reimbursable: false, status: "draft" }],
    };
    const p = jobProfit(d, "j");
    expect(p.soldBase).toBe(2300);
    expect(p.amendments).toBe(200);
    expect(p.sold).toBe(2500);
    expect(p.rows.find((r) => r.post === "subcontracting")).toMatchObject({ planned: 600, actual: 650 });
    expect(p.rows.find((r) => r.post === "labour")).toMatchObject({ planned: 400, actual: 320 });
    expect(p.rows.find((r) => r.post === "materials")).toMatchObject({ planned: 700, actual: 100 });
    expect(p.plannedMargin).toBe(800);
    expect(p.actualMargin).toBe(2500 - 1070);
    expect(p.hours).toBe(8);
  });
});
