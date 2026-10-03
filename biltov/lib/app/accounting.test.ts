import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newDoc, newJob, newLine } from "./defaults";
import { ACT_FIELDS, isBalanced, journalEntries, partnerCodes, winbooksAct, writeDbf } from "./accounting";
import type { AccountData, Doc } from "./types";

const inv = (p: Partial<Doc> = {}): Doc => ({ ...newDoc({ jobId: "j", clientId: "c", type: "invoice" }), lockedAt: "x", status: "issued", number: "F-2026-0001", issueDate: "2026-09-01", dueDate: "2026-09-30", lines: [newLine({ qty: 1, unitPrice: 1000, vat: "6" }), newLine({ qty: 1, unitPrice: 100, vat: "21" })], ...p });

function data(): AccountData {
  const d = emptyAccountData("a");
  return {
    ...d,
    clients: [newClient({ id: "c", name: "Durand Paul" })],
    jobs: [newJob({ id: "j", clientId: "c" })],
    docs: [inv(), inv({ id: "nc", type: "credit", number: "NC-2026-0001", lines: [newLine({ qty: 1, unitPrice: 100, vat: "21" })] })],
    suppliers: [{ id: "s", kind: "subcontractor", name: "Électricité Martin", bce: "0403.170.701", email: "", phone: "", address: { street: "", postcode: "", city: "", country: "BE" }, trade: "", importMapping: null, notes: "" }],
    purchases: [{ id: "p", type: "invoice", supplierId: "s", jobId: null, number: "EM-1", date: "2026-09-10", dueDate: "2026-10-10", lines: [{ id: "l", articleId: null, label: "Câblage", qty: 1, unitPrice: 500, vat: 0 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null }],
  };
}

describe("comptabilité", () => {
  it("écritures de ventes PCMN équilibrées", () => {
    const e = journalEntries(data(), "2026-01-01", "2027-01-01");
    const sale = e.find((x) => x.kind === "sale")!;
    expect(isBalanced(sale)).toBe(true);
    expect(sale.lines[0]).toMatchObject({ account: "400000", debit: 1181 });
    expect(sale.lines.filter((l) => l.account === "700000").map((l) => l.credit)).toEqual([100, 1000]);
    expect(sale.lines.find((l) => l.account === "451000")!.credit).toBe(81);
    const nc = e.find((x) => x.kind === "credit")!;
    expect(nc.lines[0]).toMatchObject({ account: "400000", credit: 121 });
    expect(isBalanced(nc)).toBe(true);
  });
  it("sous-traitance autoliquidée : 604000, TVA due et déductible", () => {
    const p = journalEntries(data(), "2026-01-01", "2027-01-01").find((x) => x.kind === "purchase")!;
    expect(isBalanced(p)).toBe(true);
    expect(p.lines[0]).toMatchObject({ account: "604000", debit: 500 });
    expect(p.lines.find((l) => l.account === "451000")!.credit).toBe(105);
    expect(p.lines.at(-1)).toMatchObject({ account: "440000", credit: 500 });
  });
  it("codes tiers stables", () => {
    const m = partnerCodes([{ id: "1", name: "Durand Paul" }, { id: "2", name: "Durand Marie" }]);
    expect([...m.values()]).toEqual(["DURAND01", "DURAND02"]);
  });
  it("fichier DBF valide", () => {
    const buf = writeDbf([{ name: "A", type: "C", length: 3 }, { name: "N", type: "N", length: 8, decimals: 2 }], [{ A: "été", N: 12.5 }]);
    const v = new DataView(buf.buffer);
    expect(buf[0]).toBe(3);
    expect(v.getUint32(4, true)).toBe(1);
    expect(v.getUint16(10, true)).toBe(12);
    expect(buf.length).toBe(32 + 64 + 1 + 12 + 1);
    const act = winbooksAct(journalEntries(data(), "2026-01-01", "2027-01-01"), data().settings.accounting);
    expect(new DataView(act.buffer).getUint16(10, true)).toBe(1 + ACT_FIELDS.reduce((s, f) => s + f.length, 0));
  });
});
