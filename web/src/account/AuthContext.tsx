import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { AccountError, type AccountView } from '@core';
import { accountService, browserKv } from './service';

const TOKEN_KEY = 'kinesyp:token';

interface AuthValue {
  ready: boolean;
  token: string | null;
  view: AccountView | null;
  mode: 'server' | 'local';
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** Réserve une place patient auprès du service (quota). */
  registerPatient: (clientId: string) => Promise<void>;
  /** Paywall à afficher (quota atteint ou demande d'abonnement). */
  paywall: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
  subscribe: () => Promise<{ simulation: boolean }>;
  simulate: (action: 'subscribe' | 'cancel') => Promise<void>;
  manageSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<AccountView | null>(null);
  const [paywall, setPaywall] = useState(false);

  const setSession = useCallback(async (t: string | null, v: AccountView | null) => {
    setToken(t);
    setView(v);
    await browserKv.set(TOKEN_KEY, t ?? '');
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await browserKv.get(TOKEN_KEY);
      if (saved) {
        try {
          const v = await accountService.me(saved);
          setToken(saved);
          setView(v);
        } catch {
          await browserKv.set(TOKEN_KEY, '');
        }
      }
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (token) setView(await accountService.me(token));
  }, [token]);

  // Retour de Stripe Checkout : l'abonnement arrive par webhook, on relit le compte quelques fois.
  useEffect(() => {
    if (!token) return;
    let status: string | null = null;
    try {
      status = new URLSearchParams(window.location.search).get('billing');
    } catch {
      status = null;
    }
    if (status !== 'success') return;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      const v = await accountService.me(token).catch(() => null);
      if (v) setView(v);
      if ((v && v.entitlement.subscribed) || tries >= 10) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [token]);

  const value: AuthValue = {
    ready,
    token,
    view,
    mode: accountService.kind,
    login: async (email, password) => {
      const s = await accountService.login({ email, password });
      await setSession(s.token, s.view);
    },
    signup: async (email, password, name) => {
      const s = await accountService.signup({ email, password, name });
      await setSession(s.token, s.view);
    },
    logout: () => {
      setPaywall(false);
      void setSession(null, null);
    },
    refresh,
    registerPatient: async (clientId) => {
      if (!token) throw new AccountError('unauthorized', 'Connectez-vous');
      try {
        setView(await accountService.registerPatient(token, clientId));
      } catch (e) {
        if (e instanceof AccountError && e.code === 'quota_exceeded') setPaywall(true);
        throw e;
      }
    },
    paywall,
    openPaywall: () => setPaywall(true),
    closePaywall: () => setPaywall(false),
    subscribe: async () => {
      if (!token) return { simulation: false };
      const { url, simulation } = await accountService.startCheckout(token);
      if (url) window.location.assign(url);
      return { simulation };
    },
    simulate: async (action) => {
      if (!token || !accountService.simulate) return;
      setView(await accountService.simulate(token, action));
    },
    manageSubscription: async () => {
      if (!token || !accountService.portal) return;
      const { url } = await accountService.portal(token);
      window.location.assign(url);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de <AuthProvider>');
  return ctx;
}
