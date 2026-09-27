import Stripe from 'stripe';

import type { Subscription, SubscriptionStatus } from '../../mobile/src/core/billing.ts';
import type { Config } from './config.ts';

/**
 * Passerelle de paiement. En production : Stripe Checkout (abonnement
 * mensuel) + portail client + webhooks signés. Interface injectable pour les tests.
 */
export interface PaymentGateway {
  createCheckout(params: { accountId: string; email: string; customerId: string | null; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
  createPortal(params: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Vérifie la signature et renvoie l'événement, ou lève une erreur. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): Promise<Stripe.Event>;
}

export function stripeGateway(config: Config, client?: Stripe): PaymentGateway {
  const stripe = client ?? new Stripe(config.stripeSecretKey!);
  return {
    async createCheckout({ accountId, email, customerId, successUrl, cancelUrl }) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: config.stripePriceId!, quantity: 1 }],
        client_reference_id: accountId,
        ...(customerId ? { customer: customerId } : { customer_email: email }),
        subscription_data: { metadata: { accountId } },
        metadata: { accountId },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: 'fr',
      });
      if (!session.url) throw new Error('Stripe n’a pas renvoyé d’URL de paiement');
      return { url: session.url };
    },
    async createPortal({ customerId, returnUrl }) {
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl, locale: 'fr' });
      return { url: portal.url };
    },
    async parseWebhook(rawBody, signature) {
      if (!signature) throw new Error('signature manquante');
      return stripe.webhooks.constructEventAsync(rawBody, signature, config.stripeWebhookSecret!);
    },
  };
}

const KNOWN: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired'];

/** Abonnement Stripe → modèle interne (fin de période : sur l'abonnement ou, depuis 2025, sur ses items). */
export function toSubscription(sub: Stripe.Subscription): Subscription {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const itemEnds = sub.items?.data?.map((i) => (i as unknown as { current_period_end?: number }).current_period_end).filter((v): v is number => typeof v === 'number') ?? [];
  const end = legacy ?? (itemEnds.length ? Math.max(...itemEnds) : null);
  const status = (KNOWN as string[]).includes(sub.status) ? (sub.status as SubscriptionStatus) : 'none';
  return {
    status,
    currentPeriodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}
