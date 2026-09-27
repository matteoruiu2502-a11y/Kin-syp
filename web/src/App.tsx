import { useCallback, useEffect, useState } from 'react';

import { ageAt, localDate } from '@core';
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
      </header>
      <main>
        {/* La vue mesure reste montée pour conserver la série en cours. */}
        <div hidden={tab !== 'measure'}>
          <MeasureView onToast={notify} goReport={() => setTab('report')} />
        </div>
        {tab === 'report' && <ReportView onToast={notify} goPatients={() => setTab('patients')} />}
        {tab === 'patients' && <PatientsView onDone={() => setTab('measure')} />}
      </main>
      {toast && (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
