import { useState } from 'react';

import { FREE_PATIENT_LIMIT, SUBSCRIPTION_LABEL } from '@core';
import { useAuth } from './AuthContext';

/** Connexion / création du compte praticien. */
export function AuthView() {
  const auth = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === 'signup') await auth.signup(email, password, name);
      else await auth.login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-intro">
        <div className="brand brand-lg">
          Kiné<span>SyP</span>
        </div>
        <p className="auth-lead">Bilans articulaires assistés par vision : l’angle se mesure seul, le bilan se rédige seul.</p>
        <ul className="auth-offer">
          <li>
            <b>{FREE_PATIENT_LIMIT} patients gratuits</b> pour essayer toutes les fonctions
          </li>
          <li>
            Ensuite <b>{SUBSCRIPTION_LABEL}</b>, patients illimités, sans engagement
          </li>
          <li>Analyse vidéo sur l’appareil : aucune image envoyée</li>
        </ul>
      </div>
      <form className="panel auth-card" onSubmit={submit}>
        <div className="segmented auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'signup'} className={tab === 'signup' ? 'is-selected' : ''} onClick={() => setTab('signup')}>
            Créer un compte
          </button>
          <button type="button" role="tab" aria-selected={tab === 'login'} className={tab === 'login' ? 'is-selected' : ''} onClick={() => setTab('login')}>
            Se connecter
          </button>
        </div>
        {tab === 'signup' && (
          <>
            <label htmlFor="a-name">Nom du praticien</label>
            <input id="a-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Léa Martin" />
          </>
        )}
        <label htmlFor="a-email">E-mail</label>
        <input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="lea@cabinet-kine.fr" />
        <label htmlFor="a-pass">Mot de passe</label>
        <input
          id="a-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          placeholder={tab === 'signup' ? '8 caractères minimum' : ''}
        />
        {error && <p className="notice">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? '…' : tab === 'signup' ? 'Créer mon compte' : 'Se connecter'}
        </button>
        {tab === 'signup' && (
          <p className="muted small">
            En créant un compte, vous acceptez les{' '}
            <a href="legal/cgu.html" target="_blank" rel="noreferrer">
              conditions générales
            </a>{' '}
            et la{' '}
            <a href="legal/confidentialite.html" target="_blank" rel="noreferrer">
              politique de confidentialité
            </a>
            .
          </p>
        )}
        {auth.mode === 'local' && (
          <p className="muted small">
            Mode démonstration : les comptes sont enregistrés dans ce navigateur et le paiement est simulé. La version en ligne utilise le serveur KinéSyP et Stripe.
          </p>
        )}
      </form>
    </div>
  );
}
