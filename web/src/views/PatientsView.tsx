import { useState } from 'react';

import { ageAt, formatDateFr, localDate, parseFrenchDate, type Sex } from '@core';
import { useStore } from '../store';

export function PatientsView({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birth, setBirth] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const today = localDate(new Date());

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const birthDate = parseFrenchDate(birth);
    if (!lastName.trim() || !firstName.trim()) return setError('Nom et prénom requis.');
    if (!birthDate) return setError('Date de naissance au format JJ/MM/AAAA.');
    if (!sex) return setError('Précisez le sexe : il sert aux normes d’amplitude.');
    store.addPatient({ lastName: lastName.trim(), firstName: firstName.trim(), birthDate, sex });
    onDone();
  };

  return (
    <div className="patients">
      <section className="panel">
        <h3>Patients</h3>
        <ul className="patient-list">
          {store.patients.map((p) => {
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
                  </span>
                  <span className="muted small">
                    {p.sex === 'F' ? 'Femme' : 'Homme'} · {ageAt(p.birthDate, today)} ans · né(e) le {formatDateFr(p.birthDate)} · {count} séance{count > 1 ? 's' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

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
        <button type="submit" className="btn btn-primary">
          Créer et mesurer
        </button>
      </form>

      <section className="panel">
        <h3>Praticien</h3>
        <label htmlFor="pr-name">Nom affiché sur le bilan</label>
        <input id="pr-name" defaultValue={store.settings.practitionerName} onBlur={(e) => store.updateSettings({ practitionerName: e.target.value.trim() })} />
        <label htmlFor="pr-title">Titre</label>
        <input id="pr-title" defaultValue={store.settings.practitionerTitle} onBlur={(e) => store.updateSettings({ practitionerTitle: e.target.value.trim() })} />
        <p className="muted small">
          Données enregistrées uniquement dans ce navigateur{store.persisted ? '' : ' (stockage indisponible ici : elles seront perdues à la fermeture)'}.
        </p>
        {confirmReset ? (
          <div className="row-wrap">
            <span>Effacer toutes les données et recharger les exemples ?</span>
            <button type="button" className="btn btn-danger" onClick={() => (store.resetDemo(), setConfirmReset(false))}>
              Oui, effacer
            </button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmReset(true)}>
            Réinitialiser les données de démonstration
          </button>
        )}
      </section>
    </div>
  );
}
