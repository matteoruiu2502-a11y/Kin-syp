import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newDoc, newJob, newLine, uid } from "./defaults";
import { bucketOf, cashForecast, periodRange, receivables, retentionFor, salesJournal, toCsv, vatGrids } from "./finance";
import type { AccountData, Doc } from "./types";

const inv = (p: Partial<Doc>): Doc => ({ ...newDoc({ jobId: "j", clientId: "c", type: "invoice" }), lockedAt: "2026-01-01T00:00:00Z", status: "issued", number: "F-2026-0001", issueDate: "2026-09-01", dueDate: "2026-09-15", lines: [newLine({ label: "Travaux", qty: 1, unitPrice: 1000, vat: "6" })], ...p });

function data(): AccountData {
  const d = emptyAccountData("a@b.be");
  return { ...d, clients: [newClient({ id: "c", name: "Client" })], jobs: [newJob({ id: "j", clientId: "c", name: "Chantier" })] };
}

describe("argent à recevoir", () => {
  it("classe par ancienneté", () => {
    expect(bucketOf("2026-09-30", "2026-09-30")).toBe("notDue");
    expect(bucketOf("2026-09-01", "2026-09-30")).toBe("d30");
    expect(bucketOf("2026-08-15", "2026-09-30")).toBe("d60");
    expect(bucketOf("2026-06-01", "2026-09-30")).toBe("d60plus");
  });
  it("totalise le restant dû après paiements partiels", () => {
    const d = { ...data(), docs: [inv({ payments: [{ id: uid(), date: "2026-09-10", amount: 60, method: "virement", reference: "" }], status: "partial" }), inv({ id: "x", status: "paid" })] };
    const r = receivables(d, "2026-09-30");
    expect(r.total).toBe(1000);
    expect(r.buckets.d30).toBe(1000);
    expect(r.partial).toHaveLength(1);
  });
  it("prévision de trésorerie : entrées et sorties par semaine", () => {
    const d: AccountData = { ...data(), docs: [inv({ dueDate: "2026-10-10" })], purchases: [{ id: "p", type: "invoice", supplierId: "s", jobId: null, number: "A1", date: "2026-09-20", dueDate: "2026-10-02", lines: [{ id: "l", articleId: null, label: "x", qty: 1, unitPrice: 100, vat: 21 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null }] };
    const f = cashForecast(d, 4, "2026-09-30", 500);
    expect(f[0].outflow).toBe(121);
    expect(f[1].inflow).toBe(1060);
    expect(f[1].balance).toBe(500 - 121 + 1060);
  });
});

describe("période", () => {
  it("trimestre en cours et précédent", () => {
    expect(periodRange("quarter", "2026-09-30")).toEqual({ from: "2026-07-01", to: "2026-10-01" });
    expect(periodRange("quarter", "2026-01-15", -1)).toEqual({ from: "2025-10-01", to: "2026-01-01" });
  });
});

describe("obligation de retenue", () => {
  it("sans dettes : rien à retenir", () => {
    expect(retentionFor(1000, { checkedAt: "2026-09-30", taxDebt: false, onssDebt: false, inastiDebt: false, attestationId: null }).total).toBe(0);
  });
  it("dettes ONSS et fiscales : 35 % + 15 %", () => {
    const r = retentionFor(1000, { checkedAt: "2026-09-01", taxDebt: true, onssDebt: true, inastiDebt: true, attestationId: null }, "2026-09-01");
    expect(r.onss).toBe(350);
    expect(r.tax).toBe(150);
    expect(r.inasti).toBe(0); // volet INASTI pas encore en vigueur
    expect(r.toSupplier).toBe(500);
  });
});

describe("aide TVA et journaux", () => {
  it("grilles 01/54 pour une facture à 6 %, 49/64 pour une note de crédit", () => {
    const d = { ...data(), docs: [inv({}), inv({ id: "nc", type: "credit", number: "NC-2026-0001", lines: [newLine({ qty: 1, unitPrice: 100, vat: "6" })] })] };
    const g = vatGrids(d, "2026-07-01", "2026-10-01");
    expect(g.grids["01"]).toBe(1000);
    expect(g.grids["54"]).toBe(60);
    expect(g.grids["49"]).toBe(100);
    expect(g.grids["64"]).toBe(6);
    expect(g.toPay).toBe(54);
  });
  it("journal des ventes en CSV (point-virgule, décimales à virgule)", () => {
    const d = { ...data(), docs: [inv({})] };
    const j = salesJournal(d, "2026-01-01", "2027-01-01");
    expect(j.rows[0][8]).toBe(1000);
    const csv = toCsv(j.headers, j.rows);
    expect(csv).toContain(";1060;");
  });
});
