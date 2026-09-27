import { useState } from 'react';

import {
  AccountError,
  FREE_PATIENT_LIMIT,
  SUBSCRIPTION_LABEL,
  ageAt,
  formatDateFr,
  localDate,
  newId,
  parseFrenchDate,
  searchPatients,
  type Sex,
} from '@core';
import { useAuth } from '../account/AuthContext';
import { useStore } from '../store';

const EXAMPLE_ID = 'p-exemple';

function PlanCard() {
  const auth = useAuth();
  if (!auth.view) return null;
  const e = auth.view.entitlement;
  const sub = auth.view.subscription;
  const used = Math.min(e.patientCount, FREE_PATIENT_LIMIT);
  return (
    <section className="panel plan">
      <div className="panel-title-row">
        <h3>Mon offre</h3>
        <span className={`pill ${e.subscribed ? 'pill-ok' : e.canCreatePatient ? 'pill-info' : 'pill-warn'}`}>
          {e.subscribed ? '● Abonné' : e.canCreatePatient ? 'Gratuit' : '▲ Limite atteinte'}
        </span>
      </div>
      {e.subscribed ? (
        <>
          <p>
            Patients illimités · <b>{SUBSCRIPTION_LABEL}</b>
          </p>
          {sub.currentPeriodEnd && (
            <p className="muted small">
              {sub.cancelAtPeriodEnd || sub.status === 'canceled' ? 'Accès jusqu’au' : 'Prochain renouvellement le'} {formatDateFr(sub.currentPeriodEnd)}
            </p>
          )}
          <div className="row-wrap">
            {auth.mode === 'server' ? (
              <button type="button" className="btn" onClick={() => auth.manageSubscription()}>
                Gérer l’abonnement et les factures
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => auth.simulate('cancel')}>
                Résilier (simulation)
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="quota" aria-label={`${used} patients sur ${FREE_PATIENT_LIMIT}`}>
            {Array.from({ length: FREE_PATIENT_LIMIT }, (_, i) => (
              <span key={i} className={i < used ? 'quota-slot is-used' : 'quota-slot'} />
            ))}
            <span className="quota-label">
              {used}/{FREE_PATIENT_LIMIT} patients gratuits
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={auth.openPaywall}>
            S’abonner — {SUBSCRIPTION_LABEL}
          </button>
        </>
      )}
    </section>
  );
}

export function PatientsView({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const auth = useAuth();
  const [query, setQuery] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birth, setBirth] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const today = localDate(new Date());
  const results = searchPatients(store.patients, query);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const birthDate = parseFrenchDate(birth);
    if (!lastName.trim() || !firstName.trim()) return setError('Nom et prénom requis.');
    if (!birthDate) return setError('Date de naissance au format JJ/MM/AAAA.');
    if (!sex) return setError('Précisez le sexe : il sert aux normes d’amplitude.');
    const id = newId('p');
    setBusy(true);
    setError(null);
    try {
      // Le service de comptes réserve la place (quota) ; le dossier reste sur l'appareil.
      await auth.registerPatient(id);
      store.addPatient({ id, lastName: lastName.trim(), firstName: firstName.trim(), birthDate, sex, createdAt: new Date().toISOString() });
      setLastName('');
      setFirstName('');
      setBirth('');
      setSex(null);
      onDone();
    } catch (err) {
      if (!(err instanceof AccountError && err.code === 'quota_exceeded')) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="patients">
      <section className="panel patients-list">
        <div className="panel-title-row">
          <h3>Patients</h3>
          <span className="muted small">
            {results.length} / {store.patients.length}
          </span>
        </div>
        <div className="search">
          <label className="sr-only" htmlFor="patient-search">
            Rechercher un patient
          </label>
          <input
            id="patient-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, prénom ou date de naissance…"
            autoComplete="off"
          />
        </div>
        <ul className="patient-list">
          {results.map((p) => {
            const count = store.sessions.filter((s) => s.patientId === p.id).length;
            const selected = p.id === store.currentPatient?.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`patient ${selected ? 'is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => {
                    store.selectPatient(p.id);
                    onDone();
                  }}
                >
                  <span className="patient-name">
                    {p.lastName.toUpperCase()} {p.firstName}
                    {p.id === EXAMPLE_ID && <span className="tag tag-obs">non décompté</span>}
                  </span>
                  <span className="muted small">
                    {p.sex === 'F' ? 'Femme' : 'Homme'} · {ageAt(p.birthDate, today)} ans · né(e) le {formatDateFr(p.birthDate)} · {count} séance{count > 1 ? 's' : ''}
                  </span>
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="muted">Aucun patient ne correspond à « {query} ».</li>}
        </ul>
      </section>

      <div className="patients-side">
        <PlanCard />
        <form className="panel" onSubmit={create}>
          <h3>Nouveau patient</h3>
          <label htmlFor="p-last">Nom</label>
          <input id="p-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
          <label htmlFor="p-first">Prénom</label>
          <input id="p-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
          <label htmlFor="p-birth">Date de naissance</label>
          <input id="p-birth" value={birth} onChange={(e) => setBirth(e.target.value)} placeholder="JJ/MM/AAAA" inputMode="numeric" />
          <fieldset className="sex">
            <legend>Sexe</legend>
            {(['F', 'M'] as const).map((s) => (
              <label key={s} className={`radio ${sex === s ? 'is-selected' : ''}`}>
                <input type="radio" name="sex" value={s} checked={sex === s} onChange={() => setSex(s)} />
                {s === 'F' ? 'Femme' : 'Homme'}
              </label>
            ))}
          </fieldset>
          {error && <p className="notice">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? '…' : 'Créer et mesurer'}
          </button>
        </form>

        <section className="panel">
          <h3>Praticien</h3>
          <label htmlFor="pr-name">Nom affiché sur le bilan</label>
          <input id="pr-name" defaultValue={store.settings.practitionerName} onBlur={(e) => store.updateSettings({ practitionerName: e.target.value.trim() })} />
          <label htmlFor="pr-title">Titre</label>
          <input id="pr-title" defaultValue={store.settings.practitionerTitle} onBlur={(e) => store.updateSettings({ practitionerTitle: e.target.value.trim() })} />
          <p className="muted small">
            Dossiers patients enregistrés uniquement sur cet appareil{store.persisted ? '' : ' (stockage indisponible ici : ils seront perdus à la fermeture)'}.
          </p>
          {confirmReset ? (
            <div className="row-wrap">
              <span>Effacer les patients de ce compte et recharger l’exemple ?</span>
              <button type="button" className="btn btn-danger" onClick={() => (store.resetDemo(), setConfirmReset(false))}>
                Oui, effacer
              </button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
                Annuler
              </button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmReset(true)}>
              Réinitialiser les données de ce compte
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
