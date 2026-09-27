import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type Stripe from 'stripe';

import { SUBSCRIPTION_LABEL, entitlement } from '../../mobile/src/core/billing.ts';
import { RateLimiter, hashPassword, signToken, verifyPassword, verifyToken } from './auth.ts';
import type { Config } from './config.ts';
import type { Account, Store } from './db.ts';
import { toSubscription, type PaymentGateway } from './payments.ts';

class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY = 64 * 1024;

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'too_large', 'Requête trop volumineuse');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function parseJson(buf: Buffer): Record<string, unknown> {
  if (buf.length === 0) return {};
  try {
    const v = JSON.parse(buf.toString('utf8'));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'bad_json', 'Corps JSON invalide');
  }
}

function str(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  return typeof v === 'string' ? v.trim() : '';
}

export interface AppDeps {
  config: Config;
  store: Store;
  payments: PaymentGateway | null;
}

/** Représentation publique d'un compte (jamais le hachage du mot de passe). */
function accountView(store: Store, a: Account) {
  return {
    account: { id: a.id, email: a.email, name: a.name, createdAt: a.createdAt },
    subscription: a.subscription,
    entitlement: entitlement(a.subscription, store.patientCount(a.id)),
    plan: { price: SUBSCRIPTION_LABEL },
  };
}

export function createHandler({ config, store, payments }: AppDeps) {
  const loginLimiter = new RateLimiter(10, 15 * 60_000);
  const signupLimiter = new RateLimiter(20, 60 * 60_000);

  function authenticate(req: IncomingMessage): Account {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const id = token ? verifyToken(token, config.authSecret) : null;
    const account = id ? store.accountById(id) : null;
    if (!account) throw new HttpError(401, 'unauthorized', 'Session expirée, reconnectez-vous');
    return account;
  }

  async function handleWebhook(event: Stripe.Event): Promise<void> {
    if (!store.markEventProcessed(event.id)) return; // déjà traité (Stripe réessaie)
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const accountId = s.client_reference_id ?? s.metadata?.accountId;
        const customer = typeof s.customer === 'string' ? s.customer : s.customer?.id;
        if (accountId && customer && store.accountById(accountId)) store.setStripeCustomer(accountId, customer);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const account =
          store.accountByCustomer(customer) ?? (sub.metadata?.accountId ? store.accountById(sub.metadata.accountId) : null);
        if (!account) break;
        if (!account.stripeCustomerId) store.setStripeCustomer(account.id, customer);
        store.setSubscription(account.id, sub.id, toSubscription(sub));
        break;
      }
      default:
        break;
    }
  }

  async function route(req: IncomingMessage, url: URL): Promise<{ status: number; body: unknown }> {
    const { pathname } = url;
    const method = req.method ?? 'GET';
    const ip = req.socket.remoteAddress ?? 'unknown';

    if (method === 'GET' && pathname === '/health') return { status: 200, body: { ok: true } };

    if (method === 'POST' && pathname === '/auth/signup') {
      if (!signupLimiter.allow(ip)) throw new HttpError(429, 'rate_limited', 'Trop de tentatives, réessayez plus tard');
      const body = parseJson(await readBody(req));
      const email = str(body, 'email').toLowerCase();
      const name = str(body, 'name');
      const password = typeof body.password === 'string' ? body.password : '';
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email', 'Adresse e-mail invalide');
      if (!name) throw new HttpError(400, 'invalid_name', 'Indiquez votre nom');
      if (password.length < 8) throw new HttpError(400, 'weak_password', 'Le mot de passe doit contenir au moins 8 caractères');
      if (store.accountByEmail(email)) throw new HttpError(409, 'email_taken', 'Un compte existe déjà avec cette adresse');
      const account = store.createAccount({ id: randomUUID(), email, name, passwordHash: await hashPassword(password) });
      return { status: 201, body: { token: signToken(account.id, config.authSecret), ...accountView(store, account) } };
    }

    if (method === 'POST' && pathname === '/auth/login') {
      const body = parseJson(await readBody(req));
      const email = str(body, 'email').toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      if (!loginLimiter.allow(`${ip}|${email}`)) throw new HttpError(429, 'rate_limited', 'Trop de tentatives, réessayez dans 15 minutes');
      const account = store.accountByEmail(email);
      // Même message que le compte existe ou non (pas d'énumération des adresses).
      if (!account || !(await verifyPassword(password, account.passwordHash))) {
        throw new HttpError(401, 'bad_credentials', 'E-mail ou mot de passe incorrect');
      }
      return { status: 200, body: { token: signToken(account.id, config.authSecret), ...accountView(store, account) } };
    }

    if (method === 'GET' && pathname === '/me') {
      return { status: 200, body: accountView(store, authenticate(req)) };
    }

    // Réserve une place de patient : c'est ici que le quota gratuit est appliqué.
    if (method === 'POST' && pathname === '/patients') {
      const account = authenticate(req);
      const clientId = str(parseJson(await readBody(req)), 'clientId');
      if (!/^[\w-]{4,80}$/.test(clientId)) throw new HttpError(400, 'invalid_client_id', 'Identifiant de patient invalide');
      return store.transaction(() => {
        if (store.hasPatient(account.id, clientId)) return { status: 200, body: accountView(store, account) };
        const e = entitlement(account.subscription, store.patientCount(account.id));
        if (!e.canCreatePatient) {
          throw new HttpError(402, 'quota_exceeded', `Limite de ${e.patientLimit} patients gratuits atteinte. Abonnez-vous (${SUBSCRIPTION_LABEL}) pour continuer.`, {
            entitlement: e,
          });
        }
        store.addPatient(account.id, clientId);
        return { status: 201, body: accountView(store, account) };
      });
    }

    if (method === 'POST' && pathname === '/billing/checkout') {
      const account = authenticate(req);
      if (entitlement(account.subscription, 0).subscribed) throw new HttpError(409, 'already_subscribed', 'Votre abonnement est déjà actif');
      if (config.billingMode === 'simulation') {
        return { status: 200, body: { url: `${config.appUrl}/?billing=simulation`, simulation: true } };
      }
      const { url: checkoutUrl } = await payments!.createCheckout({
        accountId: account.id,
        email: account.email,
        customerId: account.stripeCustomerId,
        successUrl: `${config.appUrl}/?billing=success`,
        cancelUrl: `${config.appUrl}/?billing=cancel`,
      });
      return { status: 200, body: { url: checkoutUrl } };
    }

    if (method === 'POST' && pathname === '/billing/portal') {
      const account = authenticate(req);
      if (config.billingMode === 'simulation') throw new HttpError(400, 'simulation', 'Portail indisponible en mode simulation');
      if (!account.stripeCustomerId) throw new HttpError(400, 'no_customer', 'Aucun abonnement à gérer');
      return { status: 200, body: await payments!.createPortal({ customerId: account.stripeCustomerId, returnUrl: config.appUrl }) };
    }

    // Mode simulation uniquement (tests locaux sans Stripe) : active / résilie l'abonnement.
    if (method === 'POST' && pathname === '/billing/simulate' && config.billingMode === 'simulation') {
      const account = authenticate(req);
      const action = str(parseJson(await readBody(req)), 'action');
      const end = new Date(Date.now() + 30 * 86_400_000).toISOString();
      store.setSubscription(
        account.id,
        'sim',
        action === 'cancel' ? { status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false } : { status: 'active', currentPeriodEnd: end, cancelAtPeriodEnd: false },
      );
      return { status: 200, body: accountView(store, store.accountById(account.id)!) };
    }

    if (method === 'POST' && pathname === '/stripe/webhook') {
      if (!payments) throw new HttpError(404, 'not_found', 'Introuvable');
      const raw = await readBody(req);
      let event: Stripe.Event;
      try {
        event = await payments.parseWebhook(raw, req.headers['stripe-signature'] as string | undefined);
      } catch {
        throw new HttpError(400, 'bad_signature', 'Signature Stripe invalide');
      }
      await handleWebhook(event);
      return { status: 200, body: { received: true } };
    }

    throw new HttpError(404, 'not_found', 'Introuvable');
  }

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    let status = 500;
    let body: unknown = { error: 'internal', message: 'Erreur interne' };
    try {
      const out = await route(req, new URL(req.url ?? '/', 'http://localhost'));
      status = out.status;
      body = out.body;
    } catch (e) {
      if (e instanceof HttpError) {
        status = e.status;
        body = { error: e.code, message: e.message, ...e.extra };
      } else {
        console.error(e);
      }
    }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
  };
}
