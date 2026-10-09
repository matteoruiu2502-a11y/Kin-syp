// Point d'entrée Cloudflare Workers : lit la configuration (variables et secrets) et branche les routes.

import { createApp } from "./app";
import { d1Store, type D1Like } from "./store";
import { stripeApi, type Prices } from "./stripe";
import { httpAccessPoint, simulationAccessPoint } from "./peppol";

type Env = {
  DB: D1Like;
  SITE_URL: string;
  ALLOWED_ORIGIN: string;
  STRIPE_PRICES: string;
  STRIPE_TAX_RATE: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  LICENSE_PRIVATE_KEY: string;
  PEPPOL_PROVIDER: string;
  PEPPOL_API_URL?: string;
  PEPPOL_API_KEY?: string;
};

const appFor = (env: Env) =>
  createApp({
    store: d1Store(env.DB),
    stripe: env.STRIPE_SECRET_KEY ? stripeApi(env.STRIPE_SECRET_KEY) : null,
    accessPoint: env.PEPPOL_PROVIDER === "http" && env.PEPPOL_API_URL && env.PEPPOL_API_KEY ? httpAccessPoint(env.PEPPOL_API_URL, env.PEPPOL_API_KEY) : simulationAccessPoint,
    signKey: env.LICENSE_PRIVATE_KEY,
    prices: JSON.parse(env.STRIPE_PRICES || "{}") as Prices,
    taxRate: env.STRIPE_TAX_RATE,
    siteUrl: env.SITE_URL.replace(/\/$/, ""),
    allowedOrigin: env.ALLOWED_ORIGIN,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
  });

export default {
  fetch: (req: Request, env: Env) => appFor(env).fetch(req),
  scheduled: async (_event: unknown, env: Env) => {
    await appFor(env).billOverage();
  },
};
