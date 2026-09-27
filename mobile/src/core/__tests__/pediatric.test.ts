import { JOINTS_BY_ID } from '../joints';
import { angle2D } from '../geometry';
import { progressToward, targetPoint } from '../pediatric';

describe('targetPoint', () => {
  it("place la cible à l'amplitude visée, dans le sens du mouvement", () => {
    const def = JOINTS_BY_ID.knee_right;
    const hip = { x: 0, y: -100 };
    const knee = { x: 0, y: 0 };
    const ankle = { x: 30, y: 95 }; // léger fléchissement vers x+
    const target = targetPoint(def, hip, knee, ankle, 90)!;
    expect(180 - angle2D(hip, knee, target)).toBeCloseTo(90, 5);
    expect(target.x).toBeGreaterThan(0);
  });

  it('suit la convention épaule (élévation)', () => {
    const def = JOINTS_BY_ID.shoulder_left;
    const target = targetPoint(def, { x: 0, y: 100 }, { x: 0, y: 0 }, { x: 10, y: 80 }, 150)!;
    expect(angle2D({ x: 0, y: 100 }, { x: 0, y: 0 }, target)).toBeCloseTo(150, 5);
  });
});

describe('progressToward', () => {
  it('borne la progression entre 0 et 1', () => {
    expect(progressToward(45, 0, 90)).toBeCloseTo(0.5);
    expect(progressToward(120, 0, 90)).toBe(1);
    expect(progressToward(-5, 0, 90)).toBe(0);
  });
});
