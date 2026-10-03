import { describe, expect, it } from "vitest";
import { guessInvoice, parseAmount } from "./invoiceOcr";
import { structuredCommunication } from "../tax/belgium";

const comm = structuredCommunication("1234567890");
const sample = `NÉGOCE MATÉRIAUX SA
Quai de la Batte 5 - 4020 Liège
TVA BE 0403.170.701
FACTURE N° NM-2026-1182
Date : 14/09/2026
Échéance : 14/10/2026
Colle carrelage C2 20 kg 4 x 21,60 86,40
Receveur 90x120 1 x 260,00 260,00
TVA 21 % 1.000,00 210,00
TVA 6 % 500,00 30,00
Total HTVA 1.500,00
Total TVA 240,00
Total TVAC 1.740,00
IBAN BE68 5390 0754 7034
Communication : ${comm}`;

describe("OCR facture fournisseur", () => {
  it("montants belges", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1 234.56")).toBe(1234.56);
    expect(parseAmount("86,40")).toBe(86.4);
  });
  it("extrait les champs d'une facture", () => {
    const g = guessInvoice(sample);
    expect(g.kind).toBe("invoice");
    expect(g.number).toBe("NM-2026-1182");
    expect(g.date).toBe("2026-09-14");
    expect(g.dueDate).toBe("2026-10-14");
    expect(g.vatRows).toEqual([
      { rate: 21, base: 1000, vat: 210 },
      { rate: 6, base: 500, vat: 30 },
    ]);
    expect(g.totalHtva).toBe(1500);
    expect(g.totalTvac).toBe(1740);
    expect(g.iban).toBe("BE68 5390 0754 7034");
    expect(g.bce).toBe("0403170701");
    expect(g.structuredComm).toBe(comm);
    expect(g.supplier).toBe("NÉGOCE MATÉRIAUX SA");
    expect(g.confidence).toBeGreaterThan(0.9);
  });
  it("déduit le taux depuis HTVA / TVAC et reconnaît un bon de livraison", () => {
    const g = guessInvoice("BigMat Namur\nBon de livraison n° BL-5531\n02/10/2026\nTotal HTVA 200,00\nTotal TVAC 242,00");
    expect(g.kind).toBe("delivery");
    expect(g.number).toBe("BL-5531");
    expect(g.vatRows).toEqual([{ rate: 21, base: 200, vat: 42 }]);
  });
});
