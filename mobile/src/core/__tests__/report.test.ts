import { parseDictation } from '../dictation';
import type { JointMeasurement } from '../jointAnalyzer';
import { addNote, addPosture, createSession, recordJoints, setSport, type Patient } from '../model';
import { analyzePosture } from '../posture';
import { evolutionChartSvg } from '../report/chart';
import { buildReportHtml } from '../report/reportHtml';
import { makeFrame } from './poseFixtures';

const patient: Patient = {
  id: 'p1',
  firstName: 'Léa',
  lastName: 'Martin',
  birthDate: '1988-03-12',
  sex: 'F',
  createdAt: '2026-01-01T00:00:00Z',
};

function jm(id: JointMeasurement['id'], peak: number, min: number): JointMeasurement {
  return { id, tracked: true, value: peak, peak, min, outOfPlane: false, vertex: null, velocity: 0 };
}

export function sampleReportInput() {
  let prev = recordJoints(createSession('p1', new Date('2026-09-06T10:00:00')), [jm('knee_right', 95, 12), jm('knee_left', 138, 0)]);
  prev = { ...prev, date: '2026-09-06' };
  let mid = recordJoints(createSession('p1', new Date('2026-09-17T10:00:00')), [jm('knee_right', 112, 6), jm('knee_left', 139, 0)]);
  mid = { ...mid, date: '2026-09-17' };
  let s = createSession('p1', new Date('2026-09-27T10:00:00'));
  s = recordJoints(s, [jm('knee_right', 124, 3), jm('knee_left', 140, 0), jm('elbow_right', 142, 2), jm('ankle_right', 12, -38)]);
  s = addNote(s, parseDictation('Flexion genou droit 125°, légère douleur en fin de course. Bonne progression <script>'));
  s = setSport(s, [{ jointId: 'knee_right', count: 8, meanDurationS: 1.8, meanPeakVelocity: 210, bestPeakVelocity: 245, meanRange: 110 }]);
  s = addPosture(s, { view: 'front', metrics: analyzePosture(makeFrame().landmarks)!.metrics, capturedAt: 'x' });
  return {
    patient,
    session: s,
    history: [prev, mid, s],
    practitioner: { name: 'M. Dupont', title: 'Masseur-kinésithérapeute' },
    photos: [],
    generatedAt: new Date('2026-09-27T12:00:00Z'),
  };
}

describe('buildReportHtml', () => {
  const html = buildReportHtml(sampleReportInput());

  it('contient les sections du bilan', () => {
    for (const title of [
      'Amplitudes articulaires mesurées',
      'Symétrie gauche / droite',
      'Évolution des amplitudes (3 séances)',
      "Performance — vitesse d'exécution",
      'Analyse posturale',
      'Observations du praticien',
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain('MARTIN Léa');
    expect(html).toContain('38 ans');
  });

  it('compare aux normes et calcule la symétrie', () => {
    expect(html).toContain('Genou D');
    expect(html).toMatch(/LSI/);
    expect(html).toContain('Déficit droit');
  });

  it('échappe le texte dicté', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('evolutionChartSvg', () => {
  it('produit un SVG avec légende, norme et étiquettes directes', () => {
    const svg = evolutionChartSvg({
      title: 'Genou',
      series: [
        { key: 'left', label: 'Gauche', points: [{ date: '2026-09-01', value: 130 }] },
        { key: 'right', label: 'Droite', points: [{ date: '2026-09-01', value: 90 }, { date: '2026-09-15', value: 110 }] },
      ],
      norm: 140,
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Norme 140°');
    expect(svg).toContain('D 110°');
    expect(svg).toContain('stroke-dasharray');
  });
});
