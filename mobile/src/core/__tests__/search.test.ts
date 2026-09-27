import type { Patient } from '../model';
import { patientMatches, searchPatients } from '../search';

const p = (lastName: string, firstName: string, birthDate = '1988-03-12'): Patient => ({
  id: `${lastName}-${firstName}`,
  lastName,
  firstName,
  birthDate,
  sex: 'F',
  createdAt: '2026-01-01T00:00:00Z',
});

const patients = [p('Martin', 'Léa'), p('Lefèvre', 'Émile', '2015-07-01'), p('Dubois', 'Camille', '1991-05-14'), p('Amartin', 'Paul')];

describe('recherche de patients', () => {
  it('ignore accents et casse', () => {
    expect(patientMatches(patients[1], 'lefevre')).toBe(true);
    expect(patientMatches(patients[1], 'EMILE')).toBe(true);
  });

  it('accepte les mots dans le désordre', () => {
    expect(searchPatients(patients, 'lea martin').map((x) => x.lastName)).toEqual(['Martin']);
  });

  it('trouve par date de naissance', () => {
    expect(searchPatients(patients, '14/05').map((x) => x.lastName)).toEqual(['Dubois']);
    expect(searchPatients(patients, '2015').map((x) => x.lastName)).toEqual(['Lefèvre']);
  });

  it('classe en tête les noms qui commencent par la recherche', () => {
    expect(searchPatients(patients, 'martin').map((x) => x.lastName)).toEqual(['Martin', 'Amartin']);
  });

  it('renvoie tout, trié, pour une recherche vide', () => {
    expect(searchPatients(patients, '  ').map((x) => x.lastName)).toEqual(['Amartin', 'Dubois', 'Lefèvre', 'Martin']);
  });
});
