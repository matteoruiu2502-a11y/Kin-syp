// Comptes Biltov. Supabase branché : comptes en ligne (Supabase Auth), retrouvés sur tous les appareils.
// Sinon : comptes enregistrés sur l'appareil, mot de passe dérivé par PBKDF2-SHA256 (WebCrypto),
// jamais stocké en clair.

import type { User } from "@supabase/supabase-js";
import { createClient, supabaseConfigured } from "@/utils/supabase/client";
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
  constructor(public code: "exists" | "invalid" | "weak" | "confirm" | "unconfirmed" | "network") {
    super(code);
  }
}

const cloudAccount = (u: User): Account => ({ id: u.id, email: u.email ?? "", salt: "", hash: "", createdAt: u.created_at, cloud: true });

/** Traduit les erreurs de Supabase Auth. */
function cloudError(err: { code?: string; message?: string; status?: number }): AuthError {
  if (err.code === "user_already_exists" || err.code === "email_exists") return new AuthError("exists");
  if (err.code === "email_not_confirmed") return new AuthError("unconfirmed");
  if (err.code === "weak_password") return new AuthError("weak");
  if (err.code === "invalid_credentials") return new AuthError("invalid");
  return new AuthError(err.status && err.status < 500 ? "invalid" : "network");
}

async function cloudSignUp(email: string, password: string): Promise<Account> {
  const { data, error } = await createClient()
    .auth.signUp({ email: normalizeEmail(email), password, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    .catch(() => ({ data: null, error: { status: 0 } }));
  if (error) throw cloudError(error);
  // e-mail déjà inscrit : Supabase répond sans erreur mais avec un utilisateur sans identité
  if (data?.user && !data.user.identities?.length) throw new AuthError("exists");
  // confirmation par e-mail activée : pas de session tant que le lien n'a pas été ouvert
  if (!data?.session || !data.user) throw new AuthError("confirm");
  setSession(null);
  return cloudAccount(data.user);
}

async function cloudLogIn(email: string, password: string): Promise<Account> {
  const { data, error } = await createClient()
    .auth.signInWithPassword({ email: normalizeEmail(email), password })
    .catch(() => ({ data: null, error: { status: 0 } }));
  if (error || !data?.user) throw cloudError(error ?? {});
  setSession(null);
  return cloudAccount(data.user);
}

/** Compte enregistré sur cet appareil avant le passage en ligne (même e-mail) : ses données sont reprises. */
export async function localAccountFor(email: string) {
  return (await listAccounts()).find((a) => a.email === normalizeEmail(email)) ?? null;
}

export async function signUp(email: string, password: string): Promise<Account> {
  if (password.length < 8) throw new AuthError("weak");
  if (supabaseConfigured) return cloudSignUp(email, password);
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
  if (supabaseConfigured) return cloudLogIn(email, password);
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
  if (id === DEMO_ID) return demoAccount;
  if (supabaseConfigured) {
    // session Supabase gardée par le navigateur ; getSession() fonctionne aussi hors ligne
    const { data } = await createClient().auth.getSession();
    return data.session ? cloudAccount(data.session.user) : null;
  }
  if (!id) return null;
  return (await listAccounts()).find((a) => a.id === id) ?? null;
}

/** Déconnexion (session de l'appareil et session Supabase). */
export async function signOut() {
  setSession(null);
  if (supabaseConfigured) await createClient().auth.signOut({ scope: "local" }).catch(() => {});
}

/** Entre dans l'espace de démonstration (aucun compte nécessaire). */
export function enterDemo() {
  setSession(DEMO_ID);
  return demoAccount;
}
