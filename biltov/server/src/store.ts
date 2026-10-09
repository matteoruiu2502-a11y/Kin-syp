// Stockage du serveur : Cloudflare D1 en production, mémoire pour les tests.

import type { Subscription } from "../../lib/billing/entitlement";

export type AccountRow = { id: string; secretHash: string; email: string; bce: string; createdAt: string; sub: Subscription; customerId: string | null; subscriptionId: string | null };
export type UsageRow = { accountId: string; periodStart: string; periodEnd: string; peppol: number; quota: number; overagePrice: number | null; overageBilled: boolean };
export type SendRow = { providerId: string; status: string; sentAt: string };

export interface Store {
  getAccount(id: string): Promise<AccountRow | null>;
  getAccountByCustomer(customerId: string): Promise<AccountRow | null>;
  putAccount(row: AccountRow): Promise<void>;
  trialOwner(bce: string): Promise<string | null>;
  setTrialOwner(bce: string, accountId: string): Promise<void>;
  getUsage(accountId: string, periodStart: string): Promise<UsageRow | null>;
  /** Ajoute delta au compteur de la période (création si besoin) et renvoie le nouveau total — opération atomique. */
  addUsage(row: Omit<UsageRow, "peppol" | "overageBilled">, delta: number): Promise<number>;
  getSend(accountId: string, docId: string): Promise<SendRow | null>;
  putSend(accountId: string, docId: string, send: SendRow): Promise<void>;
  /** Périodes terminées avec des factures au-delà du quota, pas encore facturées. */
  unbilledOverage(nowIso: string): Promise<UsageRow[]>;
  markOverageBilled(accountId: string, periodStart: string): Promise<void>;
}

// ── Cloudflare D1 ─────────────────────────────────────────────────────────────

/** Sous-ensemble de l'API D1 utilisé ici (évite une dépendance aux types Cloudflare). */
export type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> } };
};

type AccountDb = { id: string; secret_hash: string; email: string; bce: string; created_at: string; sub: string; customer_id: string | null; subscription_id: string | null };
type UsageDb = { account_id: string; period_start: string; period_end: string; peppol: number; quota: number; overage_price: number | null; overage_billed: number };

const toAccount = (r: AccountDb | null): AccountRow | null => (r ? { id: r.id, secretHash: r.secret_hash, email: r.email, bce: r.bce, createdAt: r.created_at, sub: JSON.parse(r.sub), customerId: r.customer_id, subscriptionId: r.subscription_id } : null);
const toUsage = (r: UsageDb): UsageRow => ({ accountId: r.account_id, periodStart: r.period_start, periodEnd: r.period_end, peppol: r.peppol, quota: r.quota, overagePrice: r.overage_price, overageBilled: !!r.overage_billed });

export function d1Store(db: D1Like): Store {
  return {
    getAccount: async (id) => toAccount(await db.prepare("SELECT * FROM accounts WHERE id = ?").bind(id).first<AccountDb>()),
    getAccountByCustomer: async (c) => toAccount(await db.prepare("SELECT * FROM accounts WHERE customer_id = ?").bind(c).first<AccountDb>()),
    putAccount: async (a) => {
      await db
        .prepare("INSERT INTO accounts (id, secret_hash, email, bce, created_at, sub, customer_id, subscription_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, bce = excluded.bce, sub = excluded.sub, customer_id = excluded.customer_id, subscription_id = excluded.subscription_id")
        .bind(a.id, a.secretHash, a.email, a.bce, a.createdAt, JSON.stringify(a.sub), a.customerId, a.subscriptionId)
        .run();
    },
    trialOwner: async (bce) => (await db.prepare("SELECT account_id FROM trials WHERE bce = ?").bind(bce).first<{ account_id: string }>())?.account_id ?? null,
    setTrialOwner: async (bce, id) => {
      await db.prepare("INSERT OR IGNORE INTO trials (bce, account_id) VALUES (?, ?)").bind(bce, id).run();
    },
    getUsage: async (id, start) => {
      const r = await db.prepare("SELECT * FROM usage WHERE account_id = ? AND period_start = ?").bind(id, start).first<UsageDb>();
      return r ? toUsage(r) : null;
    },
    addUsage: async (u, delta) => {
      const r = await db
        .prepare("INSERT INTO usage (account_id, period_start, period_end, peppol, quota, overage_price) VALUES (?, ?, ?, MAX(?, 0), ?, ?) ON CONFLICT(account_id, period_start) DO UPDATE SET peppol = MAX(peppol + ?, 0), quota = excluded.quota, overage_price = excluded.overage_price RETURNING peppol")
        .bind(u.accountId, u.periodStart, u.periodEnd, delta, u.quota, u.overagePrice, delta)
        .first<{ peppol: number }>();
      return r?.peppol ?? 0;
    },
    getSend: async (id, doc) => {
      const r = await db.prepare("SELECT provider_id, status, sent_at FROM sends WHERE account_id = ? AND doc_id = ?").bind(id, doc).first<{ provider_id: string; status: string; sent_at: string }>();
      return r ? { providerId: r.provider_id, status: r.status, sentAt: r.sent_at } : null;
    },
    putSend: async (id, doc, s) => {
      await db.prepare("INSERT OR REPLACE INTO sends (account_id, doc_id, provider_id, status, sent_at) VALUES (?, ?, ?, ?, ?)").bind(id, doc, s.providerId, s.status, s.sentAt).run();
    },
    unbilledOverage: async (now) => (await db.prepare("SELECT * FROM usage WHERE overage_price IS NOT NULL AND overage_billed = 0 AND peppol > quota AND period_end <= ?").bind(now).all<UsageDb>()).results.map(toUsage),
    markOverageBilled: async (id, start) => {
      await db.prepare("UPDATE usage SET overage_billed = 1 WHERE account_id = ? AND period_start = ?").bind(id, start).run();
    },
  };
}

// ── Mémoire (tests) ───────────────────────────────────────────────────────────

export function memoryStore(): Store & { accounts: Map<string, AccountRow>; usage: Map<string, UsageRow> } {
  const accounts = new Map<string, AccountRow>();
  const trials = new Map<string, string>();
  const usage = new Map<string, UsageRow>();
  const sends = new Map<string, SendRow>();
  const k = (a: string, b: string) => `${a}|${b}`;
  return {
    accounts,
    usage,
    getAccount: async (id) => structuredClone(accounts.get(id) ?? null),
    getAccountByCustomer: async (c) => structuredClone([...accounts.values()].find((a) => a.customerId === c) ?? null),
    putAccount: async (a) => void accounts.set(a.id, structuredClone(a)),
    trialOwner: async (bce) => trials.get(bce) ?? null,
    setTrialOwner: async (bce, id) => void (trials.has(bce) || trials.set(bce, id)),
    getUsage: async (id, start) => structuredClone(usage.get(k(id, start)) ?? null),
    addUsage: async (u, delta) => {
      const cur = usage.get(k(u.accountId, u.periodStart));
      const next: UsageRow = { ...u, peppol: Math.max(0, (cur?.peppol ?? 0) + delta), overageBilled: cur?.overageBilled ?? false };
      usage.set(k(u.accountId, u.periodStart), next);
      return next.peppol;
    },
    getSend: async (id, doc) => sends.get(k(id, doc)) ?? null,
    putSend: async (id, doc, s) => void sends.set(k(id, doc), s),
    unbilledOverage: async (now) => [...usage.values()].filter((u) => u.overagePrice !== null && !u.overageBilled && u.peppol > u.quota && u.periodEnd <= now),
    markOverageBilled: async (id, start) => {
      const u = usage.get(k(id, start));
      if (u) u.overageBilled = true;
    },
  };
}
