import { NO_SUBSCRIPTION, SUBSCRIPTION_LABEL, entitlement, type Subscription } from '../billing';
import { AccountError, type AccountService, type AccountView, type AuthSession } from './types';

/**
 * Mode démonstration : comptes stockés sur l'appareil et paiement SIMULÉ.
 * Sert à essayer l'application sans serveur ; n'offre aucune garantie
 * (les données locales sont modifiables). La production utilise le serveur.
 */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface LocalCrypto {
  /** Dérivation lente du mot de passe (PBKDF2…), encodée en texte. */
  hash(password: string, salt: string): Promise<string>;
  randomId(): string;
}

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
  subscription: Subscription;
  patients: string[];
}

const KEY = 'kinesyp:accounts';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function localAccountService(kv: KeyValue, crypto: LocalCrypto, now: () => Date = () => new Date()): AccountService {
  async function load(): Promise<StoredAccount[]> {
    const raw = await kv.get(KEY);
    try {
      return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
    } catch {
      return [];
    }
  }
  const save = (accounts: StoredAccount[]) => kv.set(KEY, JSON.stringify(accounts));

  function view(a: StoredAccount): AccountView {
    return {
      account: { id: a.id, email: a.email, name: a.name, createdAt: a.createdAt },
      subscription: a.subscription,
      entitlement: entitlement(a.subscription, a.patients.length, now()),
      plan: { price: SUBSCRIPTION_LABEL },
    };
  }

  // Jeton local : identifiant du compte (le mode démo n'a pas de serveur à qui prouver l'identité).
  const tokenFor = (a: StoredAccount) => `local:${a.id}`;

  async function byToken(token: string): Promise<[StoredAccount[], StoredAccount]> {
    const accounts = await load();
    const a = accounts.find((x) => tokenFor(x) === token);
    if (!a) throw new AccountError('unauthorized', 'AuthSession expirée, reconnectez-vous');
    return [accounts, a];
  }

  return {
    kind: 'local',
    async signup({ email, password, name }): Promise<AuthSession> {
      const e = email.trim().toLowerCase();
      if (!EMAIL_RE.test(e)) throw new AccountError('invalid_email', 'Adresse e-mail invalide');
      if (!name.trim()) throw new AccountError('invalid_name', 'Indiquez votre nom');
      if (password.length < 8) throw new AccountError('weak_password', 'Le mot de passe doit contenir au moins 8 caractères');
      const accounts = await load();
      if (accounts.some((a) => a.email === e)) throw new AccountError('email_taken', 'Un compte existe déjà avec cette adresse');
      const salt = crypto.randomId();
      const a: StoredAccount = {
        id: crypto.randomId(),
        email: e,
        name: name.trim(),
        salt,
        hash: await crypto.hash(password, salt),
        createdAt: now().toISOString(),
        subscription: NO_SUBSCRIPTION,
        patients: [],
      };
      await save([...accounts, a]);
      return { token: tokenFor(a), view: view(a) };
    },
    async login({ email, password }): Promise<AuthSession> {
      const a = (await load()).find((x) => x.email === email.trim().toLowerCase());
      if (!a || (await crypto.hash(password, a.salt)) !== a.hash) {
        throw new AccountError('bad_credentials', 'E-mail ou mot de passe incorrect');
      }
      return { token: tokenFor(a), view: view(a) };
    },
    async me(token) {
      return view((await byToken(token))[1]);
    },
    async registerPatient(token, clientId) {
      const [accounts, a] = await byToken(token);
      if (a.patients.includes(clientId)) return view(a);
      const e = entitlement(a.subscription, a.patients.length, now());
      if (!e.canCreatePatient) {
        throw new AccountError('quota_exceeded', `Limite de ${e.patientLimit} patients gratuits atteinte. Abonnez-vous (${SUBSCRIPTION_LABEL}) pour continuer.`);
      }
      a.patients.push(clientId);
      await save(accounts);
      return view(a);
    },
    async startCheckout(token) {
      const [, a] = await byToken(token);
      if (entitlement(a.subscription, 0, now()).subscribed) throw new AccountError('already_subscribed', 'Votre abonnement est déjà actif');
      return { url: null, simulation: true };
    },
    async simulate(token, action) {
      const [accounts, a] = await byToken(token);
      a.subscription =
        action === 'subscribe'
          ? { status: 'active', currentPeriodEnd: new Date(now().getTime() + 30 * 86_400_000).toISOString(), cancelAtPeriodEnd: false }
          : NO_SUBSCRIPTION;
      await save(accounts);
      return view(a);
    },
  };
}
