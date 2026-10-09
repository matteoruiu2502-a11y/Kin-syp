import { beforeAll, describe, expect, it } from "vitest";
import { createApp, type Deps } from "./app";
import { memoryStore } from "./store";
import type { AccessPoint } from "./peppol";
import { simulationAccessPoint } from "./peppol";
import type { StripeApi } from "./stripe";
import { b64url, verifyLicense, type LicensePayload } from "../../lib/billing/license";
import { entitlementOf } from "../../lib/billing/entitlement";
import { PLANS, TRIAL } from "../../lib/plans";

const DAY = 864e5;
const T0 = Date.parse("2026-10-01T09:00:00Z");
const UBL = '<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"></Invoice>';
const PRICES = { starter_monthly: "price_s_m", starter_yearly: "price_s_y", pro_monthly: "price_p_m", pro_yearly: "price_p_y", max_monthly: "price_m_m", max_yearly: "price_m_y" };
let keys: { priv: string; pub: string };

beforeAll(async () => {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const b64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");
  keys = { priv: b64(await crypto.subtle.exportKey("pkcs8", k.privateKey)), pub: b64(await crypto.subtle.exportKey("spki", k.publicKey)) };
});

function fakeStripe() {
  const calls: { method: string; path: string; params?: Record<string, unknown> }[] = [];
  const subs = new Map<string, Record<string, unknown>>();
  const api: StripeApi = {
    async request(method, path, params) {
      calls.push({ method, path, params });
      if (path === "/checkout/sessions") return { url: "https://checkout.stripe.test/s" } as never;
      if (path.startsWith("/subscriptions/")) {
        const id = path.split("/")[2];
        const cur = subs.get(id)!;
        if (method === "POST") {
          const items = (params?.items as { price: string }[] | undefined)?.[0];
          const next = { ...cur, cancel_at_period_end: params?.cancel_at_period_end ?? cur.cancel_at_period_end, items: items ? { data: [{ id: "si_1", price: { id: items.price }, current_period_start: T0 / 1000, current_period_end: T0 / 1000 + 30 * 86400 }] } : cur.items };
          subs.set(id, next);
          return next as never;
        }
        return cur as never;
      }
      return { id: "x" } as never;
    },
  };
  return { api, calls, subs };
}

function setup(over: Partial<Deps> = {}) {
  let t = T0;
  const store = memoryStore();
  const stripe = fakeStripe();
  const app = createApp({ store, stripe: stripe.api, accessPoint: simulationAccessPoint, signKey: keys.priv, prices: PRICES, taxRate: "txr_21", siteUrl: "https://site.test/biltov", allowedOrigin: "https://site.test", webhookSecret: "whsec_test", now: () => t, ...over });
  const call = async (path: string, body: Record<string, unknown>) => {
    const res = await app.fetch(new Request(`https://api.test${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const lic = async (token: unknown) => (await verifyLicense(String(token), keys.pub)) as LicensePayload;
  return { app, store, stripe, call, lic, advance: (ms: number) => (t += ms), at: () => t };
}

const ACC = { accountId: "acc-1", secret: "s3cret-s3cret", email: "artisan@test.be", bce: "0712.345.036", createdAt: new Date(T0).toISOString() };
const send = (docId: string) => ({ accountId: ACC.accountId, secret: ACC.secret, docId, documentNumber: `F-${docId}`, receiver: "0208:0477472701", ubl: UBL });

/** Abonnement Stripe actif simulé pour un forfait donné. */
async function subscribe(s: ReturnType<typeof setup>, plan: keyof typeof PLANS) {
  const acc = (await s.store.getAccount(ACC.accountId))!;
  const sub = { id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false, start_date: T0 / 1000, metadata: { accountId: acc.id }, items: { data: [{ id: "si_1", price: { id: PRICES[`${plan}_monthly`] }, current_period_start: s.at() / 1000, current_period_end: s.at() / 1000 + 30 * 86400 }] } };
  s.stripe.subs.set("sub_1", sub);
  await webhook(s, "customer.subscription.updated", sub);
}

async function webhook(s: ReturnType<typeof setup>, type: string, object: Record<string, unknown>, secret = "whsec_test") {
  const payload = JSON.stringify({ type, data: { object } });
  const ts = Math.floor(s.at() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`))).toString("hex");
  const res = await s.app.fetch(new Request("https://api.test/stripe/webhook", { method: "POST", body: payload, headers: { "Stripe-Signature": `t=${ts},v1=${sig}` } }));
  return res.status;
}

describe("serveur : essai et licence", () => {
  it("l'inscription démarre l'essai et renvoie une licence signée", async () => {
    const s = setup();
    const r = await s.call("/v1/register", ACC);
    expect(r.status).toBe(200);
    const l = await s.lic(r.body.license);
    expect(l.sub.status).toBe("trial");
    expect(entitlementOf(l.sub, T0).plan).toBe(TRIAL.plan);
    // une licence modifiée est rejetée
    const [, sig] = String(r.body.license).split(".");
    const fake = { ...(await s.lic(r.body.license)), sub: { ...(await s.lic(r.body.license)).sub, plan: "max", status: "active" } };
    const forged = `${b64url(new TextEncoder().encode(JSON.stringify(fake)))}.${sig}`;
    expect(await verifyLicense(forged, keys.pub)).toBeNull();
  });

  it("un seul essai par numéro d'entreprise", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    const r = await s.call("/v1/register", { ...ACC, accountId: "acc-2" });
    expect(entitlementOf((await s.lic(r.body.license)).sub, T0 + 1000).status).toBe("expired");
  });

  it("mauvais secret refusé", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    expect((await s.call("/v1/license", { accountId: ACC.accountId, secret: "autre-secret" })).status).toBe(403);
  });
});

describe("serveur : comptage et quota des factures Peppol", () => {
  it("essai : 5 factures, la 6e est refusée", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    for (let i = 1; i <= TRIAL.peppolInvoices; i++) expect((await s.call("/v1/peppol/send", send(`d${i}`))).status).toBe(200);
    const r = await s.call("/v1/peppol/send", send("d6"));
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("quota");
  });

  it("seuls les envois réussis sont comptés ; une facture n'est jamais comptée deux fois", async () => {
    let fail = true;
    const flaky: AccessPoint = { name: "flaky", send: async (d) => (fail ? { ok: false, error: "panne" } : simulationAccessPoint.send(d)) };
    const s = setup({ accessPoint: flaky });
    await s.call("/v1/register", ACC);
    expect((await s.call("/v1/peppol/send", send("d1"))).status).toBe(502);
    fail = false;
    const ok = await s.call("/v1/peppol/send", send("d1"));
    expect(ok.status).toBe(200);
    expect((await s.lic(ok.body.license)).usage?.peppol).toBe(1);
    const again = await s.call("/v1/peppol/send", send("d1"));
    expect(again.body.already).toBe(true);
    expect((await s.lic(again.body.license)).usage?.peppol).toBe(1);
  });

  it("Starter : bloqué à 30 avec le forfait Pro proposé ; nouvelle période = compteur à zéro", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    await subscribe(s, "starter");
    for (let i = 1; i <= PLANS.starter.invoicesPerMonth; i++) expect((await s.call("/v1/peppol/send", send(`s${i}`))).status).toBe(200);
    const r = await s.call("/v1/peppol/send", send("s31"));
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ error: "quota", upgrade: "pro" });
    s.advance(31 * DAY);
    const next = await s.call("/v1/peppol/send", send("s31"));
    expect(next.status).toBe(200);
    expect((await s.lic(next.body.license)).usage?.peppol).toBe(1);
  });

  it("Max : dépassement autorisé, puis facturé à 0,40 € HTVA par facture en fin de période", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    await subscribe(s, "max");
    const quota = PLANS.max.invoicesPerMonth;
    for (let i = 1; i <= quota + 3; i++) {
      const r = await s.call("/v1/peppol/send", send(`m${i}`));
      expect(r.status).toBe(200);
      if (i === quota + 1) expect(r.body.overage).toBe(true);
    }
    expect(await s.app.billOverage()).toBe(0); // période pas encore terminée
    s.advance(31 * DAY);
    expect(await s.app.billOverage()).toBe(1);
    const item = s.stripe.calls.find((c) => c.path === "/invoiceitems")!;
    expect(item.params).toMatchObject({ customer: "cus_1", amount: Math.round(3 * PLANS.max.overagePrice! * 100), currency: "eur", tax_rates: ["txr_21"] });
    expect(await s.app.billOverage()).toBe(0); // jamais facturé deux fois
  });
});

describe("serveur : paiements Stripe", () => {
  it("souscription : prix du forfait, TVA 21 %, retour vers l'abonnement", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    const r = await s.call("/v1/checkout", { accountId: ACC.accountId, secret: ACC.secret, plan: "pro", cycle: "yearly" });
    expect(r.body.url).toBe("https://checkout.stripe.test/s");
    const c = s.stripe.calls.find((x) => x.path === "/checkout/sessions")!;
    expect(c.params).toMatchObject({ mode: "subscription", line_items: [{ price: "price_p_y", quantity: 1 }], subscription_data: { default_tax_rates: ["txr_21"] } });
  });

  it("notification non signée refusée", async () => {
    const s = setup();
    expect(await webhook(s, "invoice.paid", {}, "mauvais-secret")).toBe(400);
  });

  it("paiement échoué : délai de grâce, puis lecture seule et envoi refusé", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    await subscribe(s, "pro");
    expect(await webhook(s, "invoice.payment_failed", { customer: "cus_1", subscription: "sub_1" })).toBe(200);
    expect((await s.store.getAccount(ACC.accountId))!.sub.status).toBe("past_due");
    expect((await s.call("/v1/peppol/send", send("p1"))).status).toBe(200);
    s.advance(8 * DAY);
    const r = await s.call("/v1/peppol/send", send("p2"));
    expect(r).toMatchObject({ status: 402, body: { error: "readonly" } });
    await webhook(s, "invoice.paid", { customer: "cus_1" });
    expect((await s.call("/v1/peppol/send", send("p2"))).status).toBe(200);
  });

  it("changement de forfait au prorata : montée facturée tout de suite", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    await subscribe(s, "starter");
    const r = await s.call("/v1/subscription/change", { accountId: ACC.accountId, secret: ACC.secret, plan: "max", cycle: "monthly" });
    expect(r.status).toBe(200);
    expect((await s.lic(r.body.license)).sub.plan).toBe("max");
    const c = s.stripe.calls.filter((x) => x.path === "/subscriptions/sub_1" && x.method === "POST").pop()!;
    expect(c.params).toMatchObject({ proration_behavior: "always_invoice", items: [{ id: "si_1", price: "price_m_m" }] });
    const down = await s.call("/v1/subscription/change", { accountId: ACC.accountId, secret: ACC.secret, plan: "pro", cycle: "monthly" });
    expect((await s.lic(down.body.license)).sub.plan).toBe("pro");
    expect(s.stripe.calls.filter((x) => x.method === "POST").pop()!.params).toMatchObject({ proration_behavior: "create_prorations" });
  });

  it("annulation : accès jusqu'à la fin de la période, données conservées", async () => {
    const s = setup();
    await s.call("/v1/register", ACC);
    await subscribe(s, "pro");
    const r = await s.call("/v1/subscription/cancel", { accountId: ACC.accountId, secret: ACC.secret });
    const sub = (await s.lic(r.body.license)).sub;
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(entitlementOf(sub, s.at() + DAY).readOnly).toBe(false);
    expect(entitlementOf(sub, s.at() + 40 * DAY).readOnly).toBe(true);
  });
});
