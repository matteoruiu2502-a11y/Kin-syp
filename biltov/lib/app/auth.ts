// Comptes enregistrés sur l'appareil. Mot de passe dérivé par PBKDF2-SHA256 (WebCrypto) :
// il n'est jamais stocké en clair.

import { idbGet, idbSet } from "./db";
import type { Account } from "./types";
import { DEMO_ID, demoAccount } from "./demo";

const ACCOUNTS_KEY = "accounts";
const SESSION_KEY = "biltov.session";
const ITERATIONS = 210_000;

const toHex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function listAccounts() {
  return (await idbGet<Account[]>(ACCOUNTS_KEY)) ?? [];
}

export class AuthError extends Error {
  constructor(public code: "exists" | "invalid" | "weak") {
    super(code);
  }
}

export async function signUp(email: string, password: string): Promise<Account> {
  if (password.length < 8) throw new AuthError("weak");
  const accounts = await listAccounts();
  const e = normalizeEmail(email);
  if (accounts.some((a) => a.email === e)) throw new AuthError("exists");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const account: Account = { id: crypto.randomUUID(), email: e, salt: toHex(salt), hash: await derive(password, salt), createdAt: new Date().toISOString() };
  await idbSet(ACCOUNTS_KEY, [...accounts, account]);
  setSession(account.id);
  return account;
}

export async function logIn(email: string, password: string): Promise<Account> {
  const account = (await listAccounts()).find((a) => a.email === normalizeEmail(email));
  if (!account || (await derive(password, fromHex(account.salt))) !== account.hash) throw new AuthError("invalid");
  setSession(account.id);
  return account;
}

export function setSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export async function currentAccount(): Promise<Account | null> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {}
  if (!id) return null;
  if (id === DEMO_ID) return demoAccount;
  return (await listAccounts()).find((a) => a.id === id) ?? null;
}

/** Entre dans l'espace de démonstration (aucun compte nécessaire). */
export function enterDemo() {
  setSession(DEMO_ID);
  return demoAccount;
}
