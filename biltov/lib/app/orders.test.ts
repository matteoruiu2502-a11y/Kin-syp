import { describe, expect, it } from "vitest";
import { emptyAccountData } from "./defaults";
import { compareOrder, invoiceGap, nextOrderStatus } from "./orders";
import type { AccountData, Purchase } from "./types";

const p = (x: Partial<Purchase>): Purchase => ({ id: "", type: "order", supplierId: "s", jobId: null, number: "", date: "2026-09-01", dueDate: "2026-09-01", lines: [], status: "ordered", source: "manual", retention: null, paidAt: null, fileId: null, ...x });

describe("commandes fournisseurs", () => {
  it("statuts successifs", () => {
    expect(nextOrderStatus("ordered")).toBe("preparing");
    expect(nextOrderStatus("verified")).toBeNull();
  });
  it("compare commande, livraison et facture", () => {
    const d: AccountData = {
      ...emptyAccountData("a"),
      purchases: [
        p({ id: "o", lines: [{ id: "1", articleId: "colle", label: "Colle", qty: 10, unitPrice: 20, vat: 21 }, { id: "2", articleId: "joint", label: "Joint", qty: 5, unitPrice: 8, vat: 21 }] }),
        p({ id: "bl", type: "delivery", orderId: "o", status: "delivered", lines: [{ id: "3", articleId: "colle", label: "Colle", qty: 8, unitPrice: 20, vat: 21 }] }),
        p({ id: "f", type: "invoice", orderId: "o", status: "to_pay", lines: [{ id: "4", articleId: "colle", label: "Colle", qty: 10, unitPrice: 21, vat: 21 }] }),
      ],
    };
    const rows = compareOrder(d, "o");
    const colle = rows.find((r) => r.key === "colle")!;
    expect(colle).toMatchObject({ ordered: 10, delivered: 8, invoiced: 10, invoicePrice: 21 });
    expect(colle.issues.sort()).toEqual(["over", "price", "short"]);
    expect(rows.find((r) => r.key === "joint")!.issues).toEqual(["missing"]);
    expect(invoiceGap(rows)).toBe(10);
  });
});

import { newArticle, newDoc, newLine } from "./defaults";
import { ordersFromQuote } from "./orders";
describe("devis → bons de commande", () => {
  it("un bon par fournisseur, composants d'ouvrage, sans main-d'œuvre", () => {
    const colle = newArticle({ id: "colle", supplierId: "s1", purchasePrice: 20, name: { fr: "Colle", nl: "", de: "" } });
    const joint = newArticle({ id: "joint", supplierId: "s2", purchasePrice: 8, name: { fr: "Joint", nl: "", de: "" } });
    const mo = newArticle({ id: "mo", type: "labour" });
    const ouvrage = newArticle({ id: "ouv", type: "package", components: [{ articleId: "colle", qty: 0.5 }, { articleId: "mo", qty: 1 }] });
    const q = { ...newDoc({ jobId: "j", clientId: "c", type: "quote" }), id: "q", status: "accepted" as const, lines: [newLine({ articleId: "ouv", qty: 10 }), newLine({ articleId: "joint", qty: 3 }), newLine({ articleId: "mo", qty: 5 })] };
    const [d, orders] = ordersFromQuote({ ...emptyAccountData("a"), articles: [colle, joint, mo, ouvrage], docs: [q] }, "q", "s1");
    expect(orders).toHaveLength(2);
    expect(orders.find((o) => o.supplierId === "s1")!.lines).toMatchObject([{ articleId: "colle", qty: 5, unitPrice: 20 }]);
    expect(orders.find((o) => o.supplierId === "s2")!.lines).toMatchObject([{ articleId: "joint", qty: 3 }]);
    expect(d.purchases[0].number).toMatch(/^BC-\d{4}-0002$/);
  });
});
