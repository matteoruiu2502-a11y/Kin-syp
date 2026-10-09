-- Base Cloudflare D1 du serveur Biltov (abonnements et compteur de factures Peppol).
-- Création : npx wrangler d1 execute biltov --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,              -- identifiant du compte (créé dans l'application)
  secret_hash TEXT NOT NULL,        -- empreinte SHA-256 du secret du compte
  email TEXT NOT NULL,
  bce TEXT NOT NULL,                -- numéro d'entreprise (un seul essai par entreprise)
  created_at TEXT NOT NULL,
  sub TEXT NOT NULL,                -- abonnement (JSON : forfait, statut, période…)
  customer_id TEXT,                 -- client Stripe
  subscription_id TEXT              -- abonnement Stripe
);
CREATE INDEX IF NOT EXISTS accounts_customer ON accounts (customer_id);

CREATE TABLE IF NOT EXISTS trials (
  bce TEXT PRIMARY KEY,
  account_id TEXT NOT NULL
);

-- Factures envoyées via Peppol, par entreprise et par période d'usage
CREATE TABLE IF NOT EXISTS usage (
  account_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  peppol INTEGER NOT NULL DEFAULT 0,
  quota INTEGER NOT NULL,
  overage_price REAL,               -- prix par facture au-delà du quota (Max), sinon NULL
  overage_billed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, period_start)
);

-- Envois réussis : une facture n'est jamais comptée deux fois
CREATE TABLE IF NOT EXISTS sends (
  account_id TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (account_id, doc_id)
);
