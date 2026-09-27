import { useState } from 'react';

import { FREE_PATIENT_LIMIT, SUBSCRIPTION_LABEL } from '@core';
import { useAuth } from './AuthContext';

/** Fenêtre d'abonnement : quota atteint, ou demande depuis le compte. */
export function Paywall() {
  const auth = useAuth();
  const [step, setStep] = useState<'offer' | 'simulated-checkout'>('offer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!auth.paywall || !auth.view) return null;
  const e = auth.view.entitlement;

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const { simulation } = await auth.subscribe();
      if (simulation) setStep('simulated-checkout');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmSimulated = async () => {
    setBusy(true);
    await auth.simulate('subscribe');
    setBusy(false);
    setStep('offer');
    auth.closePaywall();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className="modal">
        {step === 'offer' ? (
          <>
            <h2 id="paywall-title">{e.canCreatePatient ? 'Passer à l’abonnement' : `Vos ${FREE_PATIENT_LIMIT} patients gratuits sont utilisés`}</h2>
            <p className="muted">Continuez à suivre vos patients sans limite, avec toutes les fonctions.</p>
            <div className="price">
              <span className="price-amount">50 €</span>
              <span className="muted">par mois, par praticien · sans engagement</span>
            </div>
            <ul className="auth-offer">
              <li>Patients illimités</li>
              <li>Mesure automatique, compensations, mode fantôme</li>
              <li>Dictée, bilan PDF, modes Sport, Pédiatrie, Posturo</li>
              <li>Résiliable à tout moment depuis votre compte</li>
            </ul>
            {error && <p className="notice">{error}</p>}
            <div className="row-wrap">
              <button type="button" className="btn btn-primary btn-lg" onClick={subscribe} disabled={busy}>
                {busy ? '…' : `S’abonner — ${SUBSCRIPTION_LABEL}`}
              </button>
              <button type="button" className="btn" onClick={auth.closePaywall}>
                Plus tard
              </button>
            </div>
            <p className="muted small">Paiement sécurisé par Stripe. Factures mensuelles disponibles dans votre compte.</p>
          </>
        ) : (
          <>
            <h2 id="paywall-title">Paiement simulé</h2>
            <p className="notice">
              Mode démonstration : aucun paiement réel n’est effectué. En production, cette étape est la page de paiement sécurisée Stripe.
            </p>
            <div className="price">
              <span className="price-amount">50 €</span>
              <span className="muted">/ mois · {auth.view.account.email}</span>
            </div>
            <div className="row-wrap">
              <button type="button" className="btn btn-primary btn-lg" onClick={confirmSimulated} disabled={busy}>
                Confirmer l’abonnement simulé
              </button>
              <button type="button" className="btn" onClick={() => setStep('offer')}>
                Retour
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
