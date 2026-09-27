import { httpAccountService, localAccountService, type AccountService, type KeyValue } from '@core';

/**
 * Serveur KinéSyP si VITE_API_URL est défini (production) ; sinon mode
 * démonstration : comptes dans ce navigateur et paiement simulé.
 */
const memory = new Map<string, string>();
export const browserKv: KeyValue = {
  async get(k) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    } catch {
      /* stockage indisponible : mémoire */
    }
    return memory.get(k) ?? null;
  },
  async set(k, v) {
    memory.set(k, v);
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignoré */
    }
  },
};

async function pbkdf2(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 210_000 }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

export const accountService: AccountService = apiUrl
  ? httpAccountService(apiUrl)
  : localAccountService(browserKv, { hash: pbkdf2, randomId: () => crypto.randomUUID() });
