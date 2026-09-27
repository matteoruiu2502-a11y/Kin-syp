import {
  JOINTS,
  JOINTS_BY_ID,
  JOINT_KINDS,
  JOINT_KIND_LABELS,
  LSI_RETURN_TO_SPORT,
  SIDES,
  compareToNorm,
  jointId,
  symmetries,
  type JointAnalysis,
  type JointId,
  type Norm,
  type PostureAnalysis,
  type Repetition,
} from '@core';
import { fmtJoint, jointTone } from './format';

export function HeroReadout({ analysis, norm }: { analysis: JointAnalysis; norm: Norm | null }) {
  const id = analysis.activeJointId;
  if (!id) return null;
  const m = analysis.joints[id];
  const def = JOINTS_BY_ID[id];
  const cmp = norm && m.peak !== null ? compareToNorm(m.peak, norm) : null;
  return (
    <div className="hero" aria-live="polite">
      <div className="hero-label">
        {def.label} · {def.movement}
        {analysis.focusLocked && <span className="lock"> verrouillé</span>}
      </div>
      <div className={`hero-value tone-${jointTone(m, true)}`}>
        {fmtJoint(id, m.value)}
        <span className="hero-unit">°</span>
      </div>
      <div className="hero-stats">
        <span>
          max <b>{fmtJoint(id, m.peak)}°</b>
        </span>
        <span>
          min <b>{fmtJoint(id, m.min)}°</b>
        </span>
        {cmp && norm && (
          <span>
            <b>{cmp.percent} %</b> de la norme ({norm.max}°)
          </span>
        )}
      </div>
    </div>
  );
}

export function JointGrid({ analysis, onSelect }: { analysis: JointAnalysis; onSelect: (id: JointId | null) => void }) {
  return (
    <div className="joint-grid" role="group" aria-label="Articulations">
      <div className="jg-head" />
      <div className="jg-head">Gauche</div>
      <div className="jg-head">Droite</div>
      {JOINT_KINDS.map((kind) => (
        <FragmentRow key={kind} kind={kind} analysis={analysis} onSelect={onSelect} />
      ))}
    </div>
  );
}

function FragmentRow({ kind, analysis, onSelect }: { kind: (typeof JOINT_KINDS)[number]; analysis: JointAnalysis; onSelect: (id: JointId | null) => void }) {
  return (
    <>
      <div className="jg-kind">{JOINT_KIND_LABELS[kind]}</div>
      {SIDES.map((side) => {
        const id = jointId(kind, side);
        const m = analysis.joints[id];
        const active = analysis.activeJointId === id;
        const locked = analysis.focusLocked && active;
        return (
          <button
            key={side}
            type="button"
            className={`jg-cell tone-${jointTone(m, active)}${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
            aria-pressed={locked}
            title={locked ? 'Revenir à la détection automatique' : 'Verrouiller l’affichage sur cette articulation'}
            onClick={() => onSelect(locked ? null : id)}
          >
            <span className="jg-value">{fmtJoint(id, m.value)}°</span>
            <span className="jg-peak">max {fmtJoint(id, m.peak)}°</span>
          </button>
        );
      })}
    </>
  );
}

export function SportPanel({ analysis, repCount, lastRep }: { analysis: JointAnalysis; repCount: number; lastRep: Repetition | null }) {
  const peaks: Partial<Record<JointId, number | null>> = {};
  for (const j of JOINTS) {
    const m = analysis.joints[j.id];
    peaks[j.id] = m.peak !== null && m.min !== null && m.peak - m.min >= 10 ? m.peak : null;
  }
  const sym = symmetries(peaks);
  const active = analysis.activeJointId ? JOINTS_BY_ID[analysis.activeJointId] : null;
  return (
    <section className="panel">
      <h3>Symétrie gauche / droite</h3>
      {sym.length === 0 ? (
        <p className="muted">Mesurez les deux côtés d’une articulation pour calculer l’asymétrie.</p>
      ) : (
        <ul className="metric-list">
          {sym.map((s) => {
            const ok = s.lsi >= LSI_RETURN_TO_SPORT;
            return (
              <li key={s.kind}>
                <span className={`pill ${ok ? 'pill-ok' : 'pill-warn'}`}>{ok ? '● OK' : '▲ Déficit'}</span>
                <span className="metric-label">{s.label}</span>
                <span className="metric-value">{s.asymmetryPercent} %</span>
                <span className="muted">LSI {s.lsi} %</span>
              </li>
            );
          })}
        </ul>
      )}
      <h3>Vitesse d’exécution {active ? `· ${active.label}` : ''}</h3>
      <div className="rep-row">
        <span className="rep-count">{repCount}</span>
        <span className="muted">répétition{repCount > 1 ? 's' : ''}</span>
      </div>
      {lastRep ? (
        <dl className="stats">
          <div>
            <dt>Durée</dt>
            <dd>{((lastRep.endMs - lastRep.startMs) / 1000).toFixed(2)} s</dd>
          </div>
          <div>
            <dt>Vitesse max</dt>
            <dd>{Math.round(lastRep.peakVelocity)} °/s</dd>
          </div>
          <div>
            <dt>Amplitude</dt>
            <dd>{Math.round(lastRep.range)}°</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">Un aller-retour complet compte pour une répétition.</p>
      )}
    </section>
  );
}

export function PosturePanel({ posture }: { posture: PostureAnalysis | null }) {
  return (
    <section className="panel">
      <h3>Posture {posture ? (posture.view === 'front' ? '· vue de face' : '· vue de profil') : ''}</h3>
      {!posture && <p className="muted">Patient debout et immobile, de face ou de profil.</p>}
      <ul className="metric-list">
        {posture?.metrics.map((m) => (
          <li key={m.key}>
            <span className={`pill ${m.status === 'ok' ? 'pill-ok' : 'pill-warn'}`}>{m.status === 'ok' ? '● Aligné' : '▲ À surveiller'}</span>
            <span className="metric-label">
              {m.label}
              <small>{m.detail}</small>
            </span>
            <span className="metric-value">
              {m.value}
              {m.unit === '°' ? '°' : ' %'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
