import { describe, expect, it } from "vitest";
import { structuredCommunication } from "../tax/belgium";
import { parseCoda } from "./coda";

const rec21 = (amountCents: number, comm12: string, date = "150326") => {
  const amount = String(amountCents * 10).padStart(15, "0"); // 3 décimales
  const line = "21" + "0001" + "0000" + "REF123456789012345678" + "0" + amount + date + "00150000" + "1" + "101" + comm12;
  return line.padEnd(128, " ");
};
const rec23 = (iban: string, name: string) => ("23" + "0001" + "0000" + iban.padEnd(37, " ") + name.padEnd(35, " ")).padEnd(128, " ");

describe("CODA", () => {
  it("lit montant, date, communication structurée et contrepartie", () => {
    const comm = structuredCommunication("2026000042").replace(/\D/g, "");
    const text = ["0000015032672505        00000000  DUPONT                    GKCCBEBB   00799999085 00000                                       2", rec21(123456, comm), rec23("BE68539007547034", "PAUL DURAND")].join("\n");
    const [m] = parseCoda(text);
    expect(m.amount).toBe(1234.56);
    expect(m.date).toBe("2026-03-15");
    expect(m.structured).toBe(true);
    expect(m.communication).toBe(comm);
    expect(m.counterparty).toBe("PAUL DURAND");
    expect(m.account).toBe("BE68539007547034");
  });
});
