import type { JointMeasurement } from '../jointAnalyzer';
import {
  addPosture,
  createSession,
  jointHistory,
  parseFrenchDate,
  previousGhostSession,
  recordJoints,
  setSport,
  type Session,
} from '../model';

function m(id: JointMeasurement['id'], peak: number | null, min: number | null): JointMeasurement {
  return { id, tracked: true, value: peak, peak, min, outOfPlane: false, vertex: null, velocity: 0 };
}

describe('séance', () => {
  const now = new Date('2026-09-27T10:00:00');

  it("n'enregistre que les articulations réellement mobilisées", () => {
    const s = recordJoints(createSession('p1', now), [m('knee_right', 120.4, 3), m('elbow_left', 12, 8)], now);
    expect(Object.keys(s.joints)).toEqual(['knee_right']);
    expect(s.joints.knee_right).toMatchObject({ peak: 120, min: 3 });
    expect(s.date).toBe('2026-09-27');
  });

  it('garde la meilleure amplitude sur plusieurs séries', () => {
    let s = createSession('p1', now);
    s = recordJoints(s, [m('knee_right', 110, 5)], now);
    s = recordJoints(s, [m('knee_right', 118, 9)], now);
    expect(s.joints.knee_right).toMatchObject({ peak: 118, min: 5 });
  });

  it('remplace la posture de même vue et fusionne les résultats sport', () => {
    let s = createSession('p1', now);
    s = addPosture(s, { view: 'front', metrics: [], capturedAt: 'a' });
    s = addPosture(s, { view: 'front', metrics: [], capturedAt: 'b' });
    expect(s.posture).toHaveLength(1);
    const sum = { jointId: 'knee_left' as const, count: 3, meanDurationS: 1, meanPeakVelocity: 100, bestPeakVelocity: 120, meanRange: 90 };
    s = setSport(s, [sum]);
    s = setSport(s, [{ ...sum, count: 5 }]);
    expect(s.sport).toHaveLength(1);
    expect(s.sport[0].count).toBe(5);
  });

  it("reconstruit l'historique et retrouve le dernier fantôme", () => {
    const s1: Session = { ...recordJoints(createSession('p1', new Date('2026-09-01')), [m('knee_right', 90, 10)]), date: '2026-09-01', ghostFile: 'g1.json', updatedAt: '2026-09-01T10:00:00Z' };
    const s2: Session = { ...recordJoints(createSession('p1', new Date('2026-09-15')), [m('knee_right', 110, 5)]), date: '2026-09-15', ghostFile: 'g2.json', updatedAt: '2026-09-15T10:00:00Z' };
    const s3 = createSession('p1', now);
    expect(jointHistory([s2, s1, s3], 'knee_right').map((p) => p.value)).toEqual([90, 110]);
    expect(previousGhostSession([s1, s2, s3], s3)?.ghostFile).toBe('g2.json');
  });
});

describe('parseFrenchDate', () => {
  const today = new Date('2026-09-27T12:00:00');
  it('convertit JJ/MM/AAAA en ISO', () => {
    expect(parseFrenchDate('12/03/1988', today)).toBe('1988-03-12');
    expect(parseFrenchDate('1.2.2015', today)).toBe('2015-02-01');
  });
  it('refuse les dates invalides ou futures', () => {
    expect(parseFrenchDate('31/02/2000', today)).toBeNull();
    expect(parseFrenchDate('01/01/2030', today)).toBeNull();
    expect(parseFrenchDate('hier', today)).toBeNull();
  });
});
