import { JOINTS_BY_ID, interiorToClinical, clinicalToInterior } from '../joints';
import { ageAt, compareToNorm, normFor } from '../norms';

describe('conventions goniométriques', () => {
  it.each([
    ['flexion', 90, 90],
    ['elevation', 150, 150],
    ['dorsiflexion', 80, 10],
    ['dorsiflexion', 130, -40],
  ] as const)('%s : angle intérieur %d° → %d°', (conv, interior, clinical) => {
    expect(interiorToClinical(interior, conv)).toBe(clinical);
    expect(clinicalToInterior(clinical, conv)).toBe(interior);
  });

  it('définit 10 articulations cohérentes', () => {
    expect(JOINTS_BY_ID.shoulder_right.convention).toBe('elevation');
    expect(JOINTS_BY_ID.ankle_left.label).toBe('Cheville G');
  });
});

describe('normes', () => {
  it("calcule l'âge révolu", () => {
    expect(ageAt('1980-06-15', '2026-06-14')).toBe(45);
    expect(ageAt('1980-06-15', '2026-06-15')).toBe(46);
  });

  it("module la norme selon l'âge et le sexe", () => {
    const adult = normFor('knee', 30, 'M');
    expect(adult.max).toBe(140);
    expect(normFor('knee', 75, 'M').max).toBeLessThan(adult.max);
    expect(normFor('knee', 30, 'F').max).toBeGreaterThan(adult.max);
    expect(normFor('knee', 6, 'M').ageBandLabel).toBe('2-8 ans');
  });

  it('classe l’amplitude par rapport à la norme', () => {
    const norm = normFor('knee', 30, 'M');
    expect(compareToNorm(130, norm).status).toBe('normal');
    expect(compareToNorm(105, norm).status).toBe('limited');
    expect(compareToNorm(80, norm).status).toBe('severe');
  });
});
