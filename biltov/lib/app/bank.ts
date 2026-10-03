// Banque : mouvements importés (CODA, plus tard Ponto), lettrage automatique et manuel.
// Crédits → factures clients (paiements, partiels, surplus). Débits → factures fournisseurs.

import { isStructuredCommunication } from "../tax/belgium";
import { nowIso, uid } from "./defaults";
import { computeTotals, round2 } from "./money";
import { addPayment, audit } from "./ops";
import { purchaseTotals } from "./finance";
import type { AccountData, BankMatch, BankMove, BankMoveStatus, Doc, Purchase } from "./types";
import type { CodaMovement } from "./coda";

const digits = (s: string) => s.replace(/\D/g, "");
const tag = (moveId: string) => `[${moveId}]`;

/** Factures clients émises et non soldées. */
export const openInvoicesFor = (d: AccountData) => d.docs.filter((x) => x.type === "invoice" && x.lockedAt && (x.status === "issued" || x.status === "partial"));
/** Factures fournisseurs non payées. */
export const openPurchases = (d: AccountData) => d.purchases.filter((p) => p.type === "invoice" && p.status !== "paid");

export const invoiceDue = (doc: Doc) => computeTotals(doc).due;
export const purchaseDue = (p: Purchase) => purchaseTotals(p).ttc;

/** Statut d'un mouvement selon ce qui a été lettré. */
export function moveStatus(move: Pick<BankMove, "amount" | "matches" | "status">): BankMoveStatus {
  if (move.status === "ignored") return "ignored";
  const allocated = round2(move.matches.reduce((s, m) => s + m.amount, 0));
  if (!move.matches.length) return "unmatched";
  const total = Math.abs(move.amount);
  if (allocated < total - 0.005) return "surplus"; // une partie du virement n'est affectée à aucune facture
  return "matched";
}

/** Proposition de lettrage automatique pour un mouvement. */
export function suggestMatches(d: AccountData, move: Pick<BankMove, "amount" | "communication" | "structured">): { matches: BankMatch[]; how: "structured" | "number" | "amount" | null } {
  const comm = digits(move.communication);
  if (move.amount > 0) {
    const open = openInvoicesFor(d);
    let doc = move.structured || comm.length === 12 ? open.find((x) => digits(x.structuredComm) === comm) : undefined;
    let how: "structured" | "number" | "amount" | null = doc ? "structured" : null;
    if (!doc) {
      doc = open.find((x) => x.number && move.communication.toUpperCase().includes(x.number.toUpperCase()));
      if (doc) how = "number";
    }
    if (!doc) {
      const same = open.filter((x) => Math.abs(invoiceDue(x) - move.amount) < 0.005);
      if (same.length === 1) {
        doc = same[0];
        how = "amount";
      }
    }
    if (!doc) return { matches: [], how: null };
    return { matches: [{ kind: "invoice", id: doc.id, amount: round2(Math.min(move.amount, invoiceDue(doc))) }], how };
  }
  const out = -move.amount;
  const open = openPurchases(d);
  let p = open.find((x) => (x.structuredComm && digits(x.structuredComm) === comm && comm.length === 12) || (x.number && move.communication.toUpperCase().includes(x.number.toUpperCase())));
  let how: "structured" | "number" | "amount" | null = p ? (comm.length === 12 ? "structured" : "number") : null;
  if (!p) {
    const same = open.filter((x) => Math.abs(purchaseDue(x) - out) < 0.005);
    if (same.length === 1) {
      p = same[0];
      how = "amount";
    }
  }
  return p ? { matches: [{ kind: "purchase", id: p.id, amount: round2(Math.min(out, purchaseDue(p))) }], how } : { matches: [], how: null };
}

const sameMove = (a: Pick<BankMove, "date" | "amount" | "ref" | "communication">, b: Pick<BankMove, "date" | "amount" | "ref" | "communication">) =>
  a.date === b.date && Math.abs(a.amount - b.amount) < 0.005 && (a.ref ? a.ref === b.ref : a.communication === b.communication);

/** Lettre un mouvement : enregistre les paiements sur les factures, marque les achats payés. */
export function applyMatches(d: AccountData, moveId: string, matches: BankMatch[]): AccountData {
  let next = unmatch(d, moveId);
  const move = next.bankMoves.find((m) => m.id === moveId)!;
  for (const m of matches) {
    if (m.amount <= 0) continue;
    if (m.kind === "invoice") {
      next = addPayment(next, m.id, { date: move.date, amount: m.amount, method: "virement", reference: `${move.communication || move.ref} ${tag(moveId)}`.trim() });
    } else {
      next = { ...next, purchases: next.purchases.map((p) => (p.id === m.id ? { ...p, status: "paid", paidAt: move.date } : p)) };
    }
  }
  const updated = { ...move, matches: matches.filter((m) => m.amount > 0), status: "unmatched" as BankMoveStatus };
  updated.status = moveStatus(updated);
  // virement entièrement affecté, mais facture encore partiellement due
  if (updated.status === "matched" && updated.matches.some((m) => m.kind === "invoice" && invoiceDue(next.docs.find((x) => x.id === m.id)!) > 0.005)) updated.status = "partial";
  next = { ...next, bankMoves: next.bankMoves.map((x) => (x.id === moveId ? updated : x)) };
  return audit(next, "bank-match", "bank", moveId, matches.map((m) => `${m.kind}:${m.id}:${m.amount}`).join(" "));
}

/** Annule le lettrage d'un mouvement (paiements retirés, achats remis « à payer »). */
export function unmatch(d: AccountData, moveId: string): AccountData {
  const move = d.bankMoves.find((m) => m.id === moveId);
  if (!move || !move.matches.length) return d;
  const docs = d.docs.map((doc) => {
    if (!doc.payments.some((p) => p.reference.includes(tag(moveId)))) return doc;
    const payments = doc.payments.filter((p) => !p.reference.includes(tag(moveId)));
    const t = computeTotals({ ...doc, payments });
    return { ...doc, payments, status: (payments.length ? (t.due <= 0.005 ? "paid" : "partial") : "issued") as Doc["status"] };
  });
  const purchaseIds = new Set(move.matches.filter((m) => m.kind === "purchase").map((m) => m.id));
  const purchases = d.purchases.map((p) => (purchaseIds.has(p.id) ? { ...p, status: "to_pay" as const, paidAt: null } : p));
  return { ...d, docs, purchases, bankMoves: d.bankMoves.map((m) => (m.id === moveId ? { ...m, matches: [], status: "unmatched" } : m)) };
}

/** Importe des mouvements (doublons ignorés) et lettre automatiquement ce qui est sûr. */
export function importMoves(d: AccountData, moves: CodaMovement[], source: BankMove["source"] = "coda"): [AccountData, { added: number; duplicates: number; matched: number }] {
  let next = d;
  let added = 0;
  let duplicates = 0;
  let matched = 0;
  for (const m of moves) {
    const candidate = { date: m.date, amount: m.amount, ref: m.ref, communication: m.communication };
    if (next.bankMoves.some((x) => sameMove(x, candidate))) {
      duplicates++;
      continue;
    }
    const move: BankMove = { id: uid(), ...candidate, structured: m.structured, counterparty: m.counterparty, account: m.account, source, importedAt: nowIso(), matches: [], status: "unmatched", note: "" };
    next = { ...next, bankMoves: [move, ...next.bankMoves] };
    added++;
    const s = suggestMatches(next, move);
    if (s.matches.length && s.how !== "amount") {
      next = applyMatches(next, move.id, s.matches);
      matched++;
    }
  }
  return [next, { added, duplicates, matched }];
}

/** Communication structurée valide (contrôle modulo 97) extraite d'un texte libre. */
export function extractStructured(text: string): string | null {
  const m = text.match(/\+{3}\s*(\d{3})\s*\/\s*(\d{4})\s*\/\s*(\d{5})\s*\+{3}/) ?? text.match(/\b(\d{3})[/ ]?(\d{4})[/ ]?(\d{5})\b/);
  if (!m) return null;
  const c = `+++${m[1]}/${m[2]}/${m[3]}+++`;
  return isStructuredCommunication(c) ? c : null;
}

// ——— Ponto (Isabel Group) ——————————————————————————————————————————————
// L'API Ponto exige un secret client et un certificat : elle ne peut être appelée que depuis le serveur.
export type BankProvider = { name: string; configured: boolean; sync: () => Promise<CodaMovement[]> };
export const pontoProvider: BankProvider = {
  name: "Ponto",
  configured: false,
  sync: async () => {
    throw new Error("Synchronisation Ponto : nécessite le serveur Biltov (secret client et certificat).");
  },
};
