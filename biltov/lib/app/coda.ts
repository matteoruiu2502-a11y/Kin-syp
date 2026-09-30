// Import des extraits bancaires belges CODA (format Febelfin, enregistrements de 128 caractères)
// et lettrage automatique des factures via la communication structurée.

import { isStructuredCommunication } from "../tax/belgium";
import { computeTotals } from "./money";
import type { AccountData, Doc } from "./types";

export type CodaMovement = { amount: number; date: string; communication: string; structured: boolean; counterparty: string; account: string; ref: string };

const d6 = (s: string) => (/^\d{6}$/.test(s) ? `20${s.slice(4, 6)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : "");

export function parseCoda(text: string): CodaMovement[] {
  const out: CodaMovement[] = [];
  let cur: CodaMovement | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.padEnd(128, " ");
    const kind = line.slice(0, 2);
    if (kind === "21") {
      if (cur) out.push(cur);
      const sign = line[31] === "1" ? -1 : 1;
      const amount = (sign * Number(line.slice(32, 47))) / 1000;
      const structured = line[61] === "1";
      const comm = structured && line.slice(62, 65) === "101" ? line.slice(65, 77) : line.slice(62, 115).trim();
      cur = { amount, date: d6(line.slice(47, 53)), communication: comm, structured: structured && isStructuredCommunication(comm), counterparty: "", account: "", ref: line.slice(10, 31).trim() };
    } else if (kind === "22" && cur && !cur.structured) {
      cur.communication = `${cur.communication} ${line.slice(10, 63).trim()}`.trim();
    } else if (kind === "23" && cur) {
      cur.account = line.slice(10, 47).trim();
      cur.counterparty = line.slice(47, 82).trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Associe chaque crédit à une facture ouverte : d'abord la communication structurée, sinon le montant exact. */
export function matchMovements(d: AccountData, moves: CodaMovement[]) {
  const open = d.docs.filter((x) => x.type === "invoice" && x.lockedAt && (x.status === "issued" || x.status === "partial"));
  return moves
    .filter((m) => m.amount > 0)
    .map((m) => {
      let doc: Doc | undefined;
      let how: "structured" | "amount" | null = null;
      if (m.structured || digits(m.communication).length === 12) {
        doc = open.find((x) => digits(x.structuredComm) === digits(m.communication));
        if (doc) how = "structured";
      }
      if (!doc) {
        const same = open.filter((x) => Math.abs(computeTotals(x).due - m.amount) < 0.005);
        if (same.length === 1) {
          doc = same[0];
          how = "amount";
        }
      }
      return { movement: m, doc: doc ?? null, how };
    });
}
