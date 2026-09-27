import type { Entitlement, Subscription } from '../billing';

export interface AccountInfo {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/** Ce que l'application sait du compte connecté (même forme que la réponse du serveur). */
export interface AccountView {
  account: AccountInfo;
  subscription: Subscription;
  entitlement: Entitlement;
  plan: { price: string };
}

export interface AuthSession {
  token: string;
  view: AccountView;
}

export type AccountErrorCode =
  | 'invalid_email'
  | 'invalid_name'
  | 'weak_password'
  | 'email_taken'
  | 'bad_credentials'
  | 'unauthorized'
  | 'quota_exceeded'
  | 'already_subscribed'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export class AccountError extends Error {
  code: AccountErrorCode;
  constructor(code: AccountErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Service de comptes utilisé par les applications. Deux implémentations :
 * le serveur KinéSyP (production) et un mode démonstration local.
 */
export interface AccountService {
  /** 'server' : comptes et paiement réels ; 'local' : démonstration sur l'appareil. */
  readonly kind: 'server' | 'local';
  signup(p: { email: string; password: string; name: string }): Promise<AuthSession>;
  login(p: { email: string; password: string }): Promise<AuthSession>;
  me(token: string): Promise<AccountView>;
  /** Réserve une place pour un nouveau patient ; lève `quota_exceeded` au-delà de l'offre gratuite. */
  registerPatient(token: string, clientId: string): Promise<AccountView>;
  /** URL de paiement (Stripe Checkout), ou `simulation: true` pour le paiement simulé. */
  startCheckout(token: string): Promise<{ url: string | null; simulation: boolean }>;
  /** Paiement simulé (démonstration uniquement). */
  simulate?(token: string, action: 'subscribe' | 'cancel'): Promise<AccountView>;
  /** Portail de gestion de l'abonnement (factures, carte, résiliation). */
  portal?(token: string): Promise<{ url: string }>;
}
