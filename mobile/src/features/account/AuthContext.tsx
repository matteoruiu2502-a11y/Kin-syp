import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { AccountError, type AccountView } from '../../core';
import { accountService } from './service';

const TOKEN_KEY = 'kinesyp.token';

interface AuthValue {
  ready: boolean;
  view: AccountView | null;
  mode: 'server' | 'local';
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  registerPatient: (clientId: string) => Promise<void>;
  paywall: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
  /** Ouvre le paiement Stripe ; renvoie `simulation: true` en mode démonstration. */
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

  // Session conservée dans le trousseau sécurisé (Keychain / Keystore).
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (saved) {
        try {
          setView(await accountService.me(saved));
          setToken(saved);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        }
      }
      setReady(true);
    })();
  }, []);

  const start = useCallback(async (t: string, v: AccountView) => {
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    setToken(t);
    setView(v);
  }, []);

  /** Après le paiement : l'abonnement arrive par webhook, on relit le compte quelques secondes. */
  const pollSubscription = useCallback(async (t: string) => {
    for (let i = 0; i < 8; i++) {
      const v = await accountService.me(t).catch(() => null);
      if (v) setView(v);
      if (v?.entitlement.subscribed) {
        setPaywall(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, []);

  const value: AuthValue = {
    ready,
    view,
    mode: accountService.kind,
    login: async (email, password) => {
      const s = await accountService.login({ email, password });
      await start(s.token, s.view);
    },
    signup: async (email, password, name) => {
      const s = await accountService.signup({ email, password, name });
      await start(s.token, s.view);
    },
    logout: async () => {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      setPaywall(false);
      setToken(null);
      setView(null);
    },
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
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        await pollSubscription(token);
      }
      return { simulation };
    },
    simulate: async (action) => {
      if (!token || !accountService.simulate) return;
      setView(await accountService.simulate(token, action));
    },
    manageSubscription: async () => {
      if (!token || !accountService.portal) return;
      const { url } = await accountService.portal(token);
      await WebBrowser.openBrowserAsync(url);
      setView(await accountService.me(token));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de <AuthProvider>');
  return ctx;
}
