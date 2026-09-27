import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import Stripe from 'stripe';

import { createHandler } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Store } from '../src/db.ts';
import { stripeGateway, type PaymentGateway } from '../src/payments.ts';

const WEBHOOK_SECRET = 'whsec_test_secret';
const stripe = new Stripe('sk_test_fake');
const config = loadConfig({
  AUTH_SECRET: 'test-secret-test-secret-test-secret-42',
  STRIPE_SECRET_KEY: 'sk_test_fake',
  STRIPE_PRICE_ID: 'price_test_50eur',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  APP_URL: 'https://app.kinesyp.test',
});

// Vraie vérification de signature Stripe ; création de sessions simulée (pas de réseau).
const checkoutCalls: unknown[] = [];
const real = stripeGateway(config, stripe);
const payments: PaymentGateway = {
  ...real,
  async createCheckout(p) {
    checkoutCalls.push(p);
    return { url: `https://checkout.stripe.test/${p.accountId}` };
  },
};

let server: Server;
let base: string;
let store: Store;

before(async () => {
  store = new Store(':memory:');
  server = createServer(createHandler({ config, store, payments }));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  store.close();
});

async function api(path: string, init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string>; raw?: string } = {}) {
  const res = await fetch(base + path, {
    method: init.method ?? (init.body !== undefined || init.raw !== undefined ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function sendWebhook(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: 'event', type, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return api('/stripe/webhook', { raw: payload, headers: { 'stripe-signature': signature } });
}

describe('comptes praticiens', () => {
  it('crée un compte, se connecte et lit son profil', async () => {
    const signup = await api('/auth/signup', { body: { email: 'Lea@Cabinet.fr', password: 'motdepasse1', name: 'Léa Martin' } });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.account.email, 'lea@cabinet.fr');
    assert.equal(signup.body.passwordHash, undefined);
    assert.equal(JSON.stringify(signup.body).includes('scrypt'), false);
    assert.deepEqual(signup.body.entitlement, { subscribed: false, patientCount: 0, patientLimit: 5, canCreatePatient: true, remainingFree: 5 });

    const login = await api('/auth/login', { body: { email: 'lea@cabinet.fr', password: 'motdepasse1' } });
    assert.equal(login.status, 200);
    const me = await api('/me', { token: login.body.token });
    assert.equal(me.body.account.name, 'Léa Martin');
  });

  it('refuse les doublons, les mots de passe faibles et les mauvais identifiants', async () => {
    assert.equal((await api('/auth/signup', { body: { email: 'lea@cabinet.fr', password: 'motdepasse1', name: 'X' } })).status, 409);
    assert.equal((await api('/auth/signup', { body: { email: 'a@b.fr', password: 'court', name: 'X' } })).status, 400);
    const bad = await api('/auth/login', { body: { email: 'lea@cabinet.fr', password: 'mauvais-mdp' } });
    assert.equal(bad.status, 401);
    const unknown = await api('/auth/login', { body: { email: 'inconnu@cabinet.fr', password: 'mauvais-mdp' } });
    assert.equal(unknown.body.message, bad.body.message);
  });

  it('rejette un jeton falsifié', async () => {
    const { body } = await api('/auth/login', { body: { email: 'lea@cabinet.fr', password: 'motdepasse1' } });
    const forged = body.token.slice(0, -2) + (body.token.endsWith('AA') ? 'BB' : 'AA');
    assert.equal((await api('/me', { token: forged })).status, 401);
    assert.equal((await api('/me')).status, 401);
  });
});

describe('quota et abonnement', () => {
  let token: string;
  let accountId: string;

  before(async () => {
    const r = await api('/auth/signup', { body: { email: 'paul@kine.fr', password: 'motdepasse2', name: 'Paul' } });
    token = r.body.token;
    accountId = r.body.account.id;
  });

  it('autorise 5 patients gratuits puis renvoie 402', async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await api('/patients', { token, body: { clientId: `patient-${i}` } });
      assert.equal(r.status, 201, `patient ${i}`);
    }
    // Idempotent : réenregistrer un patient existant ne consomme pas de place.
    assert.equal((await api('/patients', { token, body: { clientId: 'patient-3' } })).status, 200);
    const blocked = await api('/patients', { token, body: { clientId: 'patient-6' } });
    assert.equal(blocked.status, 402);
    assert.equal(blocked.body.error, 'quota_exceeded');
    assert.match(blocked.body.message, /50 € \/ mois/);
  });

  it('ouvre une session de paiement Stripe pour le compte', async () => {
    const r = await api('/billing/checkout', { token, method: 'POST' });
    assert.equal(r.status, 200);
    assert.equal(r.body.url, `https://checkout.stripe.test/${accountId}`);
    assert.deepEqual(checkoutCalls.at(-1), {
      accountId,
      email: 'paul@kine.fr',
      customerId: null,
      successUrl: 'https://app.kinesyp.test/?billing=success',
      cancelUrl: 'https://app.kinesyp.test/?billing=cancel',
    });
  });

  it('active l’abonnement via les webhooks signés et lève la limite', async () => {
    const end = Math.floor(Date.now() / 1000) + 30 * 86400;
    assert.equal((await sendWebhook('checkout.session.completed', { id: 'cs_1', object: 'checkout.session', client_reference_id: accountId, customer: 'cus_paul' })).status, 200);
    assert.equal(
      (await sendWebhook('customer.subscription.created', { id: 'sub_1', object: 'subscription', customer: 'cus_paul', status: 'active', cancel_at_period_end: false, items: { data: [{ current_period_end: end }] }, metadata: {} })).status,
      200,
    );
    const me = await api('/me', { token });
    assert.equal(me.body.entitlement.subscribed, true);
    assert.equal(me.body.subscription.currentPeriodEnd, new Date(end * 1000).toISOString());
    assert.equal((await api('/patients', { token, body: { clientId: 'patient-6' } })).status, 201);
  });

  it("rebloque après la fin d'un abonnement résilié", async () => {
    const past = Math.floor(Date.now() / 1000) - 86400;
    await sendWebhook('customer.subscription.deleted', { id: 'sub_1', object: 'subscription', customer: 'cus_paul', status: 'canceled', cancel_at_period_end: false, items: { data: [{ current_period_end: past }] }, metadata: {} });
    const r = await api('/patients', { token, body: { clientId: 'patient-7' } });
    assert.equal(r.status, 402);
  });

  it('rejette un webhook non signé ou falsifié', async () => {
    const payload = JSON.stringify({ id: 'evt_x', type: 'customer.subscription.updated', data: { object: {} } });
    assert.equal((await api('/stripe/webhook', { raw: payload, headers: { 'stripe-signature': 't=1,v1=deadbeef' } })).status, 400);
    assert.equal((await api('/stripe/webhook', { raw: payload })).status, 400);
  });
});
