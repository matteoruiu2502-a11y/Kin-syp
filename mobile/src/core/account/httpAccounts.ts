import { AccountError, type AccountErrorCode, type AccountService, type AccountView, type AuthSession } from './types';

const KNOWN_CODES: AccountErrorCode[] = [
  'invalid_email', 'invalid_name', 'weak_password', 'email_taken', 'bad_credentials',
  'unauthorized', 'quota_exceeded', 'already_subscribed', 'rate_limited',
];

/** Client du serveur KinéSyP (voir /server). */
export function httpAccountService(baseUrl: string, fetchImpl: typeof fetch = fetch): AccountService {
  const root = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${root}${path}`, {
        method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
        headers: {
          'Content-Type': 'application/json',
          ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new AccountError('network', 'Serveur injoignable. Vérifiez la connexion Internet.');
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const code = (KNOWN_CODES as string[]).includes(String(data.error)) ? (data.error as AccountErrorCode) : 'unknown';
      throw new AccountError(code, typeof data.message === 'string' ? data.message : `Erreur ${res.status}`);
    }
    return data as T;
  }

  const toSession = (d: AccountView & { token: string }): AuthSession => {
    const { token, ...view } = d;
    return { token, view };
  };

  return {
    kind: 'server',
    signup: async (p) => toSession(await call('/auth/signup', { body: p })),
    login: async (p) => toSession(await call('/auth/login', { body: p })),
    me: (token) => call('/me', { token }),
    registerPatient: (token, clientId) => call('/patients', { token, body: { clientId } }),
    startCheckout: async (token) => {
      const d = await call<{ url: string; simulation?: boolean }>('/billing/checkout', { token, method: 'POST' });
      return { url: d.simulation ? null : d.url, simulation: Boolean(d.simulation) };
    },
    simulate: (token, action) => call('/billing/simulate', { token, body: { action } }),
    portal: (token) => call('/billing/portal', { token, method: 'POST' }),
  };
}
