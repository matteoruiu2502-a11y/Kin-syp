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
