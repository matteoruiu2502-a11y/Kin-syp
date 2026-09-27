import { DatabaseSync } from 'node:sqlite';

import { NO_SUBSCRIPTION, type Subscription, type SubscriptionStatus } from '../../mobile/src/core/billing.ts';

/**
 * Base du service de comptes. Elle ne contient AUCUNE donnée de santé :
 * comptes praticiens, abonnement, et identifiants opaques des patients
 * (pour le quota). Noms, mesures et bilans restent sur l'appareil.
 */
export interface Account {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  stripeCustomerId: string | null;
  subscription: Subscription;
}

interface AccountRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
  cancel_at_period_end: number;
}

function toAccount(r: AccountRow): Account {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
    stripeCustomerId: r.stripe_customer_id,
    subscription: {
      status: r.subscription_status as SubscriptionStatus,
      currentPeriodEnd: r.current_period_end,
      cancelAtPeriodEnd: r.cancel_at_period_end === 1,
    },
  };
}

export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        stripe_customer_id TEXT UNIQUE,
        stripe_subscription_id TEXT,
        subscription_status TEXT NOT NULL DEFAULT 'none',
        current_period_end TEXT,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS patient_slots (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (account_id, client_id)
      );
      CREATE TABLE IF NOT EXISTS processed_events (
        id TEXT PRIMARY KEY,
        processed_at TEXT NOT NULL
      );
    `);
  }

  createAccount(a: { id: string; email: string; name: string; passwordHash: string }): Account {
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO accounts (id, email, name, password_hash, created_at, subscription_status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(a.id, a.email, a.name, a.passwordHash, now, NO_SUBSCRIPTION.status);
    return this.accountById(a.id)!;
  }

  accountById(id: string): Account | null {
    const r = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
    return r ? toAccount(r) : null;
  }

  accountByEmail(email: string): Account | null {
    const r = this.db.prepare('SELECT * FROM accounts WHERE email = ?').get(email) as AccountRow | undefined;
    return r ? toAccount(r) : null;
  }

  accountByCustomer(customerId: string): Account | null {
    const r = this.db.prepare('SELECT * FROM accounts WHERE stripe_customer_id = ?').get(customerId) as AccountRow | undefined;
    return r ? toAccount(r) : null;
  }

  setStripeCustomer(accountId: string, customerId: string): void {
    this.db.prepare('UPDATE accounts SET stripe_customer_id = ? WHERE id = ?').run(customerId, accountId);
  }

  setSubscription(accountId: string, subscriptionId: string | null, sub: Subscription): void {
    this.db
      .prepare('UPDATE accounts SET stripe_subscription_id = ?, subscription_status = ?, current_period_end = ?, cancel_at_period_end = ? WHERE id = ?')
      .run(subscriptionId, sub.status, sub.currentPeriodEnd, sub.cancelAtPeriodEnd ? 1 : 0, accountId);
  }

  patientCount(accountId: string): number {
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM patient_slots WHERE account_id = ?').get(accountId) as { n: number };
    return Number(r.n);
  }

  hasPatient(accountId: string, clientId: string): boolean {
    return this.db.prepare('SELECT 1 FROM patient_slots WHERE account_id = ? AND client_id = ?').get(accountId, clientId) !== undefined;
  }

  addPatient(accountId: string, clientId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO patient_slots (account_id, client_id, created_at) VALUES (?, ?, ?)').run(accountId, clientId, new Date().toISOString());
  }

  /** Vrai si l'événement Stripe n'avait pas encore été traité (idempotence). */
  markEventProcessed(eventId: string): boolean {
    const res = this.db.prepare('INSERT OR IGNORE INTO processed_events (id, processed_at) VALUES (?, ?)').run(eventId, new Date().toISOString());
    return Number(res.changes) > 0;
  }

  /** Exécute `fn` dans une transaction (quota atomique). */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  close(): void {
    this.db.close();
  }
}
