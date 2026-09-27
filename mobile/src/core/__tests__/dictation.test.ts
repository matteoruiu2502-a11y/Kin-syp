import { parseDictation } from '../dictation';
import { parseFrenchNumber } from '../frenchNumbers';

describe('parseFrenchNumber', () => {
  it.each([
    ['quatre-vingt-dix', 90],
    ['cent vingt-cinq', 125],
    ['soixante et onze', 71],
    ['quatre-vingts', 80],
    ['cent quarante', 140],
    ['quinze', 15],
  ])('%s → %d', (text, expected) => {
    expect(parseFrenchNumber(text)).toBe(expected);
  });

  it('refuse un texte non numérique', () => {
    expect(parseFrenchNumber('genou')).toBeNull();
  });
});

describe('parseDictation', () => {
  it("structure l'exemple du cahier des charges", () => {
    const note = parseDictation('Flexion genou droit 90°, légère douleur en fin de course');
    expect(note.measures).toEqual([
      { movement: 'Flexion', region: 'Genou', side: 'right', jointId: 'knee_right', value: 90 },
    ]);
    expect(note.pain).toEqual([{ level: 'légère', eva: null, context: 'en fin de course' }]);
    expect(note.observations).toEqual([]);
  });

  it('comprend les nombres en lettres et reprend l’articulation précédente', () => {
    const note = parseDictation('flexion épaule gauche cent vingt degrés, abduction quatre-vingt-dix');
    expect(note.measures).toHaveLength(2);
    expect(note.measures[0]).toMatchObject({ region: 'Épaule', side: 'left', value: 120, jointId: 'shoulder_left' });
    expect(note.measures[1]).toMatchObject({ movement: 'Abduction', region: 'Épaule', side: 'left', value: 90 });
  });

  it("lit l'EVA sans la confondre avec une amplitude", () => {
    const note = parseDictation('Douleur genou gauche EVA 6 sur 10 à l’effort');
    expect(note.measures).toEqual([]);
    expect(note.pain[0]).toEqual({ level: 'modérée', eva: 6, context: "à l'effort" });
  });

  it('gère la négation et les observations libres', () => {
    const note = parseDictation('Pas de douleur. Bonne compliance aux exercices, marche sans boiterie');
    expect(note.pain[0].level).toBe('aucune');
    expect(note.observations).toEqual(['Bonne compliance aux exercices', 'Marche sans boiterie']);
  });

  it('conserve les régions non mesurées par la caméra', () => {
    const note = parseDictation('extension poignet droit 60°');
    expect(note.measures[0]).toMatchObject({ region: 'Poignet', side: 'right', jointId: null, value: 60 });
  });
});
