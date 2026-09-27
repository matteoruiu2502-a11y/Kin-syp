import { OneEuroFilter } from '../oneEuroFilter';

describe('OneEuroFilter', () => {
  it('renvoie la première valeur telle quelle', () => {
    expect(new OneEuroFilter().filter(42, 0)).toBe(42);
  });

  it('atténue le bruit sur un signal immobile', () => {
    const f = new OneEuroFilter();
    let maxDev = 0;
    for (let i = 0; i < 300; i++) {
      const noisy = 90 + (i % 2 === 0 ? 3 : -3);
      const out = f.filter(noisy, i * 33);
      if (i > 30) maxDev = Math.max(maxDev, Math.abs(out - 90));
    }
    expect(maxDev).toBeLessThan(1);
  });

  it('suit un mouvement rapide sans retard excessif', () => {
    const f = new OneEuroFilter();
    let out = 0;
    // Flexion de 0 à 120° en 1 s à 30 FPS (120°/s).
    for (let i = 0; i <= 30; i++) out = f.filter(i * 4, i * 33.3);
    expect(out).toBeGreaterThan(110);
  });
});
