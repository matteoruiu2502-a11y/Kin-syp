import { useCallback, useEffect, useState } from 'react';

import { ageAt, localDate, planLabel } from '@core';
import { AuthProvider, useAuth } from './account/AuthContext';
import { AuthView } from './account/AuthView';
import { Paywall } from './account/Paywall';
import { StoreProvider, useStore } from './store';
import { MeasureView } from './views/MeasureView';
import { PatientsView } from './views/PatientsView';
import { ReportView } from './views/ReportView';

type Tab = 'measure' | 'report' | 'patients';
const TABS: Array<[Tab, string]> = [
  ['measure', 'Mesure'],
  ['report', 'Bilan'],
  ['patients', 'Patients'],
];

function Shell() {
  const store = useStore();
  const auth = useAuth();
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<Tab>('measure');
  const [toast, setToast] = useState<{ id: number; text: string; tone: 'ok' | 'error' } | null>(null);
  const notify = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => setToast({ id: Date.now(), text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const p = store.currentPatient;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Kiné<span>SyP</span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'is-selected' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className={`patient-chip ${p ? '' : 'is-missing'}`} onClick={() => setTab('patients')}>
          {p ? `${p.lastName.toUpperCase()} ${p.firstName} · ${ageAt(p.birthDate, localDate(new Date()))} ans` : 'Choisir un patient'}
        </button>
        {auth.view && (
          <div className="account-menu">
            <button type="button" className="account-btn" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              {auth.view.account.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </button>
            {menu && (
              <div className="account-pop" role="menu">
                <b>{auth.view.account.name}</b>
                <span className="muted small">{auth.view.account.email}</span>
                <span className="small">{planLabel(auth.view.entitlement)}</span>
                {!auth.view.entitlement.subscribed && (
                  <button type="button" className="btn btn-primary" onClick={() => (setMenu(false), auth.openPaywall())}>
                    S’abonner — {auth.view.plan.price}
                  </button>
                )}
                <button type="button" className="btn" onClick={() => (setMenu(false), setTab('patients'))}>
                  Mon offre et mes patients
                </button>
                <button type="button" className="btn" onClick={auth.logout}>
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <main>
        {/* La vue mesure reste montée pour conserver la série en cours. */}
        <div hidden={tab !== 'measure'}>
          <MeasureView onToast={notify} goReport={() => setTab('report')} />
        </div>
        {tab === 'report' && <ReportView onToast={notify} goPatients={() => setTab('patients')} />}
        {tab === 'patients' && <PatientsView onDone={() => setTab('measure')} />}
      </main>
      <Paywall />
      {toast && (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Gate() {
  const auth = useAuth();
  if (!auth.ready) return null;
  if (!auth.view) return <AuthView />;
  // Une remontée complète par compte : chaque praticien retrouve ses propres patients.
  return (
    <StoreProvider key={auth.view.account.id} accountId={auth.view.account.id} practitionerName={auth.view.account.name}>
      <Shell />
    </StoreProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
