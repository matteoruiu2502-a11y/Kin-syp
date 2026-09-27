/** Configuration par variables d'environnement (voir README / .env.example). */
export interface Config {
  port: number;
  /** Secret de signature des jetons de session (≥ 32 caractères en production). */
  authSecret: string;
  dbPath: string;
  /** URL publique de l'application web (retour après paiement). */
  appUrl: string;
  corsOrigins: string[];
  /** 'stripe' en production ; 'simulation' pour tester sans compte Stripe. */
  billingMode: 'stripe' | 'simulation';
  stripeSecretKey: string | null;
  stripePriceId: string | null;
  stripeWebhookSecret: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const billingMode = env.BILLING_MODE === 'simulation' ? 'simulation' : 'stripe';
  const production = env.NODE_ENV === 'production';
  const authSecret = env.AUTH_SECRET ?? (production ? '' : 'dev-secret-a-remplacer-en-production-0000');
  if (authSecret.length < 32) throw new Error('AUTH_SECRET doit contenir au moins 32 caractères');
  if (production && billingMode === 'simulation') throw new Error('BILLING_MODE=simulation interdit en production');
  const config: Config = {
    port: Number(env.PORT ?? 8787),
    authSecret,
    dbPath: env.DB_PATH ?? 'kinesyp.db',
    appUrl: env.APP_URL ?? 'http://localhost:5173',
    corsOrigins: (env.CORS_ORIGINS ?? env.APP_URL ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
    billingMode,
    stripeSecretKey: env.STRIPE_SECRET_KEY ?? null,
    stripePriceId: env.STRIPE_PRICE_ID ?? null,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
  };
  if (billingMode === 'stripe' && (!config.stripeSecretKey || !config.stripePriceId || !config.stripeWebhookSecret)) {
    throw new Error('STRIPE_SECRET_KEY, STRIPE_PRICE_ID et STRIPE_WEBHOOK_SECRET sont requis (ou BILLING_MODE=simulation en local)');
  }
  return config;
}
