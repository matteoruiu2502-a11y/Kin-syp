import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newDoc, newJob, newLine } from "./defaults";
import { applyMatches, extractStructured, importMoves, suggestMatches, unmatch } from "./bank";
import { structuredCommunication } from "../tax/belgium";
import type { AccountData, Doc } from "./types";

const comm = structuredCommunication("2026000042");
const inv = (p: Partial<Doc> = {}): Doc => ({ ...newDoc({ jobId: "j", clientId: "c", type: "invoice" }), id: "inv", lockedAt: "2026-01-01T00:00:00Z", status: "issued", number: "F-2026-0042", structuredComm: comm, issueDate: "2026-09-01", dueDate: "2026-09-30", lines: [newLine({ qty: 1, unitPrice: 1000, vat: "6" })], ...p });
const base = (): AccountData => ({ ...emptyAccountData("a"), clients: [newClient({ id: "c", name: "Client" })], jobs: [newJob({ id: "j", clientId: "c" })], docs: [inv()] });
const mv = (amount: number, communication: string, structured = false) => ({ amount, date: "2026-10-01", communication, structured, counterparty: "X", account: "BE68539007547034", ref: `R${amount}${communication}` });

describe("banque", () => {
  it("valide et extrait la communication structurée", () => {
    expect(extractStructured(`Paiement ${comm} merci`)).toBe(comm);
    expect(extractStructured("+++202/6000/00099+++")).toBeNull();
  });
  it("lettre automatiquement un virement complet via la communication structurée", () => {
    const [d, r] = importMoves(base(), [mv(1060, comm.replace(/\D/g, ""), true)]);
    expect(r).toEqual({ added: 1, duplicates: 0, matched: 1 });
    expect(d.docs[0].status).toBe("paid");
    expect(d.bankMoves[0].status).toBe("matched");
  });
  it("ignore les doublons", () => {
    const [d] = importMoves(base(), [mv(1060, comm, true)]);
    const [, r] = importMoves(d, [mv(1060, comm, true)]);
    expect(r.duplicates).toBe(1);
  });
  it("paiement partiel puis surplus", () => {
    let [d] = importMoves(base(), [mv(500, "F-2026-0042")]);
    expect(d.docs[0].status).toBe("partial");
    expect(d.bankMoves[0].status).toBe("partial");
    [d] = importMoves(d, [mv(700, comm, true)]);
    const last = d.bankMoves[0];
    expect(last.matches[0].amount).toBe(560);
    expect(last.status).toBe("surplus");
    expect(d.docs[0].status).toBe("paid");
  });
  it("le montant seul est seulement proposé, pas lettré", () => {
    const [d, r] = importMoves(base(), [mv(1060, "sans référence")]);
    expect(r.matched).toBe(0);
    expect(suggestMatches(d, d.bankMoves[0]).how).toBe("amount");
  });
  it("annuler le lettrage retire le paiement", () => {
    let [d] = importMoves(base(), [mv(1060, comm, true)]);
    d = unmatch(d, d.bankMoves[0].id);
    expect(d.docs[0].payments).toHaveLength(0);
    expect(d.docs[0].status).toBe("issued");
    d = applyMatches(d, d.bankMoves[0].id, [{ kind: "invoice", id: "inv", amount: 1060 }]);
    expect(d.docs[0].status).toBe("paid");
  });
  it("débit → facture fournisseur payée", () => {
    const d0: AccountData = { ...base(), purchases: [{ id: "p", type: "invoice", supplierId: "s", jobId: null, number: "NM-1", date: "2026-09-01", dueDate: "2026-10-01", lines: [{ id: "l", articleId: null, label: "x", qty: 1, unitPrice: 100, vat: 21 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null }] };
    const [d] = importMoves(d0, [mv(-121, "Facture NM-1")]);
    expect(d.purchases[0].status).toBe("paid");
  });
});
