import {
  angle2D,
  angle3D,
  inclinationFromVertical,
  tiltFromHorizontal,
} from '../geometry';
import { interiorToFlexion } from '../joints';

describe('angle2D', () => {
  it('mesure un angle droit', () => {
    expect(angle2D({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
  });

  it('vaut 180° pour des segments alignés (extension complète)', () => {
    expect(angle2D({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 })).toBeCloseTo(180);
  });

  it('est indépendant du sens de rotation', () => {
    const a = angle2D({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 });
    const b = angle2D({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(a).toBeCloseTo(45);
    expect(b).toBeCloseTo(45);
  });

  it('renvoie NaN pour des points confondus', () => {
    expect(angle2D({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toBeNaN();
  });
});

describe('angle3D', () => {
  it('mesure un angle hors du plan image', () => {
    expect(angle3D({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(90);
  });
});

describe('inclinationFromVertical', () => {
  it('vaut 0° pour un tronc vertical (y écran vers le bas)', () => {
    expect(inclinationFromVertical({ x: 0, y: 100 }, { x: 0, y: 0 })).toBeCloseTo(0);
  });
  it('est symétrique à gauche et à droite', () => {
    expect(inclinationFromVertical({ x: 0, y: 100 }, { x: 100, y: 0 })).toBeCloseTo(45);
    expect(inclinationFromVertical({ x: 0, y: 100 }, { x: -100, y: 0 })).toBeCloseTo(45);
  });
});

describe('tiltFromHorizontal', () => {
  it('ignore le sens du segment', () => {
    expect(tiltFromHorizontal({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(45);
    expect(tiltFromHorizontal({ x: 10, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(45);
    expect(tiltFromHorizontal({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(0);
  });
});

describe('interiorToFlexion', () => {
  it('suit la convention goniométrique (0° = extension)', () => {
    expect(interiorToFlexion(180)).toBe(0);
    expect(interiorToFlexion(90)).toBe(90);
    expect(interiorToFlexion(35)).toBe(145);
  });
});
