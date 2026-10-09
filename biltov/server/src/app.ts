// Routes du serveur Biltov. Toutes les règles d'argent sont vérifiées ICI (pas seulement dans l'application) :
// statut de l'abonnement, quota de factures Peppol, dépassement facturé sur le Max.

import { GRACE_DAYS, PLANS, PLAN_ORDER, TRIAL, type Cycle, type PlanId } from "../../lib/plans";
import { canSendInvoice, entitlementOf, trialSubscription, type Subscription } from "../../lib/billing/entitlement";
import { LICENSE_TTL_DAYS, signLicense } from "../../lib/billing/license";
import type { AccountRow, Store } from "./store";
import type { AccessPoint } from "./peppol";
import { priceIdFor, subscriptionFromStripe, verifyStripeSignature, type Prices, type StripeApi, type StripeSubscription } from "./stripe";

export type Deps = {
  store: Store;
  stripe: StripeApi | null;
  accessPoint: AccessPoint;
  signKey: string;
  prices: Prices;
  taxRate: string;
  siteUrl: string;
  allowedOrigin: string;
  webhookSecret: string;
  now?: () => number;
};

const DAY = 864e5;
const MAX_UBL = 2_000_000;

class HttpError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

async function sha256(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const isPlan = (v: unknown): v is PlanId => typeof v === "string" && (PLAN_ORDER as string[]).includes(v);
const isCycle = (v: unknown): v is Cycle => v === "monthly" || v === "yearly";

export function createApp(deps: Deps) {
  const { store, accessPoint } = deps;
  const now = deps.now ?? Date.now;

  const cors = (origin: string | null) => ({
    "Access-Control-Allow-Origin": origin && (origin === deps.allowedOrigin || origin.startsWith("http://localhost")) ? origin : deps.allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
  const json = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });

  /** Licence signée : état de l'abonnement + compteur de la période en cours. */
  async function license(acc: AccountRow) {
    const t = now();
    const ent = entitlementOf(acc.sub, t);
    const u = await store.getUsage(acc.id, ent.period.start);
    return signLicense({ v: 1, acc: acc.id, sub: acc.sub, usage: u ? { periodStart: u.periodStart, peppol: u.peppol } : null, iat: t, exp: t + LICENSE_TTL_DAYS * DAY }, deps.signKey);
  }

  async function auth(body: Record<string, unknown>) {
    const id = str(body.accountId, 80);
    const secret = str(body.secret, 200);
    if (!id || !secret) throw new HttpError(400, "invalid");
    const acc = await store.getAccount(id);
    if (!acc) throw new HttpError(404, "unknown_account");
    if (acc.secretHash !== (await sha256(secret))) throw new HttpError(403, "forbidden");
    return acc;
  }

  const stripe = () => {
    if (!deps.stripe) throw new HttpError(503, "payment_not_configured");
    return deps.stripe;
  };

  async function sync(acc: AccountRow, s: StripeSubscription) {
    const next: AccountRow = { ...acc, sub: subscriptionFromStripe(acc.sub, s, deps.prices, now()), subscriptionId: s.id, customerId: acc.customerId ?? s.customer };
    await store.putAccount(next);
    return next;
  }

  const routes: Record<string, (b: Record<string, unknown>) => Promise<unknown>> = {
    /** Première connexion de l'entreprise : démarre l'essai (un seul essai par numéro d'entreprise). */
    "/v1/register": async (b) => {
      const id = str(b.accountId, 80);
      const secret = str(b.secret, 200);
      const email = str(b.email, 200);
      const bce = typeof b.bce === "string" ? b.bce.replace(/\D/g, "") : "";
      if (!id || !secret || !email || bce.length !== 10) throw new HttpError(400, "invalid");
      const existing = await store.getAccount(id);
      if (existing) return { license: await license(await auth(b)) };
      const t = now();
      // l'essai démarre à la création du compte, jamais dans le futur
      const created = Math.min(Date.parse(String(b.createdAt)) || t, t);
      let sub: Subscription = trialSubscription(new Date(created).toISOString());
      const owner = await store.trialOwner(bce);
      if (owner && owner !== id) sub = { ...sub, trialEndsAt: new Date(t).toISOString() }; // essai déjà utilisé par cette entreprise
      else await store.setTrialOwner(bce, id);
      const acc: AccountRow = { id, secretHash: await sha256(secret), email, bce, createdAt: new Date(created).toISOString(), sub, customerId: null, subscriptionId: null };
      await store.putAccount(acc);
      return { license: await license(acc) };
    },

    "/v1/license": async (b) => ({ license: await license(await auth(b)) }),

    /** Souscription : page de paiement Stripe (TVA 21 % ajoutée, numéro de TVA demandé). */
    "/v1/checkout": async (b) => {
      const acc = await auth(b);
      if (!isPlan(b.plan) || !isCycle(b.cycle)) throw new HttpError(400, "invalid");
      if (acc.subscriptionId && ["active", "past_due"].includes(acc.sub.status)) throw new HttpError(409, "already_subscribed");
      const price = priceIdFor(deps.prices, b.plan, b.cycle);
      if (!price) throw new HttpError(503, "price_not_configured");
      const session = await stripe().request<{ url: string }>("POST", "/checkout/sessions", {
        mode: "subscription",
        client_reference_id: acc.id,
        customer: acc.customerId ?? undefined,
        customer_email: acc.customerId ? undefined : acc.email,
        customer_update: acc.customerId ? { name: "auto", address: "auto" } : undefined,
        line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { accountId: acc.id }, default_tax_rates: deps.taxRate ? [deps.taxRate] : undefined },
        tax_id_collection: { enabled: true },
        billing_address_collection: "required",
        allow_promotion_codes: true,
        locale: "auto",
        success_url: `${deps.siteUrl}/tableau-de-bord/?abonnement=ok#abonnement`,
        cancel_url: `${deps.siteUrl}/tableau-de-bord/#abonnement`,
      });
      return { url: session.url };
    },

    /** Changement de forfait ou de cycle, au prorata (montée : facturée tout de suite ; descente : avoir). */
    "/v1/subscription/change": async (b) => {
      let acc = await auth(b);
      if (!isPlan(b.plan) || !isCycle(b.cycle)) throw new HttpError(400, "invalid");
      if (!acc.subscriptionId) throw new HttpError(409, "no_subscription");
      const price = priceIdFor(deps.prices, b.plan, b.cycle);
      if (!price) throw new HttpError(503, "price_not_configured");
      const cur = await stripe().request<StripeSubscription>("GET", `/subscriptions/${acc.subscriptionId}`);
      const up = PLAN_ORDER.indexOf(b.plan) > PLAN_ORDER.indexOf(acc.sub.plan ?? "starter") || (b.cycle === "yearly" && acc.sub.cycle === "monthly");
      const updated = await stripe().request<StripeSubscription>("POST", `/subscriptions/${acc.subscriptionId}`, {
        items: [{ id: cur.items.data[0].id, price }],
        proration_behavior: up ? "always_invoice" : "create_prorations",
        cancel_at_period_end: false,
      });
      acc = await sync(acc, updated);
      return { license: await license(acc) };
    },

    /** Annulation en fin de période payée (ou reprise). Aucune donnée n'est supprimée. */
    "/v1/subscription/cancel": async (b) => {
      let acc = await auth(b);
      if (!acc.subscriptionId) throw new HttpError(409, "no_subscription");
      const updated = await stripe().request<StripeSubscription>("POST", `/subscriptions/${acc.subscriptionId}`, { cancel_at_period_end: b.resume !== true });
      acc = await sync(acc, updated);
      return { license: await license(acc) };
    },

    /** Portail Stripe : moyen de paiement, factures, coordonnées. */
    "/v1/portal": async (b) => {
      const acc = await auth(b);
      if (!acc.customerId) throw new HttpError(409, "no_customer");
      const s = await stripe().request<{ url: string }>("POST", "/billing_portal/sessions", { customer: acc.customerId, return_url: `${deps.siteUrl}/tableau-de-bord/#abonnement` });
      return { url: s.url };
    },

    /** Historique de facturation (factures Stripe de l'abonnement). */
    "/v1/invoices": async (b) => {
      const acc = await auth(b);
      if (!acc.customerId || !deps.stripe) return { invoices: [] };
      const list = await stripe().request<{ data: { id: string; number: string | null; created: number; total: number; status: string; hosted_invoice_url: string | null; invoice_pdf: string | null }[] }>("GET", "/invoices", { customer: acc.customerId, limit: 24 });
      return { invoices: list.data.map((i) => ({ id: i.id, number: i.number, date: new Date(i.created * 1000).toISOString(), totalTTC: i.total / 100, status: i.status, url: i.hosted_invoice_url, pdf: i.invoice_pdf })) };
    },

    /**
     * Envoi d'une facture via Peppol. Le compteur est réservé avant l'envoi (deux envois simultanés ne peuvent pas
     * dépasser le quota) puis rendu si l'envoi échoue : seuls les envois réussis sont comptés.
     */
    "/v1/peppol/send": async (b) => {
      const acc = await auth(b);
      const docId = str(b.docId, 80);
      const number = str(b.documentNumber, 60);
      const receiver = str(b.receiver, 80);
      const ubl = typeof b.ubl === "string" && b.ubl.length <= MAX_UBL ? b.ubl : null;
      if (!docId || !number || !receiver || !ubl) throw new HttpError(400, "invalid");
      const done = await store.getSend(acc.id, docId);
      if (done) return { id: done.providerId, status: done.status, already: true, license: await license(acc) };

      const ent = entitlementOf(acc.sub, now());
      const period = { accountId: acc.id, periodStart: ent.period.start, periodEnd: ent.period.end, quota: ent.invoiceQuota, overagePrice: ent.overagePrice };
      const count = await store.addUsage(period, 1);
      const check = canSendInvoice(ent, count - 1);
      if (!check.ok) {
        await store.addUsage(period, -1);
        throw new HttpError(402, check.reason, { upgrade: check.upgrade, quota: ent.invoiceQuota, used: count - 1, trial: ent.status === "trial" ? TRIAL.peppolInvoices : undefined });
      }
      const res = await accessPoint.send({ ubl, sender: `0208:${acc.bce}`, receiver, documentNumber: number });
      if (!res.ok) {
        await store.addUsage(period, -1);
        throw new HttpError(502, "peppol_failed", { message: res.error });
      }
      await store.putSend(acc.id, docId, { providerId: res.id, status: res.status, sentAt: new Date(now()).toISOString() });
      return { id: res.id, status: res.status, overage: check.overage, license: await license(acc) };
    },
  };

  /** Notifications de Stripe : paiement réussi, échoué, changement ou fin d'abonnement. */
  async function webhook(req: Request) {
    const payload = await req.text();
    if (!(await verifyStripeSignature(payload, req.headers.get("Stripe-Signature"), deps.webhookSecret, Math.floor(now() / 1000)))) return new Response("signature", { status: 400 });
    const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
    const o = event.data.object;
    const byCustomer = async () => (typeof o.customer === "string" ? store.getAccountByCustomer(o.customer) : null);
    switch (event.type) {
      case "checkout.session.completed": {
        const acc = await store.getAccount(String(o.client_reference_id ?? ""));
        if (acc && typeof o.subscription === "string") {
          const linked = { ...acc, customerId: String(o.customer), subscriptionId: o.subscription };
          await store.putAccount(linked);
          if (deps.stripe) await sync(linked, await deps.stripe.request<StripeSubscription>("GET", `/subscriptions/${o.subscription}`));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const s = o as unknown as StripeSubscription;
        const acc = (s.metadata?.accountId ? await store.getAccount(s.metadata.accountId) : null) ?? (await byCustomer());
        if (acc) await sync(acc, s);
        break;
      }
      case "invoice.payment_failed": {
        const acc = await byCustomer();
        if (acc && acc.sub.status === "active" && o.subscription) await store.putAccount({ ...acc, sub: { ...acc.sub, status: "past_due", graceUntil: acc.sub.graceUntil ?? new Date(now() + GRACE_DAYS * DAY).toISOString() } });
        break;
      }
      case "invoice.paid": {
        const acc = await byCustomer();
        if (acc && (acc.sub.status === "past_due" || acc.sub.status === "unpaid")) await store.putAccount({ ...acc, sub: { ...acc.sub, status: "active", graceUntil: null } });
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  }

  /** Tâche de nuit : facture les factures Peppol au-delà du forfait Max des périodes terminées (TVA 21 %). */
  async function billOverage() {
    if (!deps.stripe) return 0;
    let billed = 0;
    for (const u of await store.unbilledOverage(new Date(now()).toISOString())) {
      const acc = await store.getAccount(u.accountId);
      if (!acc?.customerId || u.overagePrice === null) continue;
      const n = u.peppol - u.quota;
      const label = `Factures Peppol au-delà du forfait ${PLANS.max.name} : ${n} × ${u.overagePrice.toFixed(2).replace(".", ",")} € HTVA (période du ${u.periodStart.slice(0, 10)} au ${u.periodEnd.slice(0, 10)})`;
      try {
        await deps.stripe.request("POST", "/invoiceitems", { customer: acc.customerId, amount: Math.round(n * u.overagePrice * 100), currency: "eur", description: label, tax_rates: deps.taxRate ? [deps.taxRate] : undefined });
        await deps.stripe.request("POST", "/invoices", { customer: acc.customerId, auto_advance: true, collection_method: "charge_automatically", pending_invoice_items_behavior: "include", description: label });
        await store.markOverageBilled(u.accountId, u.periodStart);
        billed++;
      } catch {
        // nouvel essai la nuit suivante
      }
    }
    return billed;
  }

  return {
    billOverage,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const origin = req.headers.get("Origin");
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
      if (url.pathname === "/stripe/webhook" && req.method === "POST") return webhook(req);
      const route = routes[url.pathname];
      if (!route || req.method !== "POST") return json({ error: "not_found" }, 404, origin);
      try {
        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== "object") throw new HttpError(400, "invalid");
        return json(await route(body), 200, origin);
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status, origin);
        return json({ error: "server_error", message: (e as Error).message }, 500, origin);
      }
    },
  };
}
