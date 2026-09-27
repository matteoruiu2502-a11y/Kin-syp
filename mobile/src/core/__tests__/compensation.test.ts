import { CompensationDetector } from '../compensation';
import { makeFrame } from './poseFixtures';

function calibrate(detector: CompensationDetector, spec = {}): void {
  for (let i = 0; i < 15; i++) detector.process(makeFrame({ ...spec, timestampMs: i * 33 }));
}

function settle(detector: CompensationDetector, spec: Parameters<typeof makeFrame>[0]) {
  let out = detector.process(makeFrame(spec));
  for (let i = 0; i < 20; i++) out = detector.process(makeFrame(spec));
  return out;
}

describe('CompensationDetector', () => {
  it("n'alerte pas avant d'avoir capturé la posture de référence", () => {
    const d = new CompensationDetector();
    expect(d.process(makeFrame({ trunkLeanDeg: 30 }))).toEqual([]);
    expect(d.hasBaseline).toBe(false);
  });

  it('détecte une inclinaison du tronc', () => {
    const d = new CompensationDetector();
    calibrate(d);
    const out = settle(d, { trunkLeanDeg: 18 });
    expect(out.map((c) => c.kind)).toContain('trunk_lean');
    expect(out.find((c) => c.kind === 'trunk_lean')!.deviationDeg).toBeGreaterThan(10);
  });

  it("n'alerte pas pour une posture stable, même inclinée dès le départ", () => {
    const d = new CompensationDetector();
    calibrate(d, { trunkLeanDeg: 25 });
    expect(settle(d, { trunkLeanDeg: 26 })).toEqual([]);
  });

  it('détecte une bascule du bassin en vue de face', () => {
    const d = new CompensationDetector();
    calibrate(d);
    const out = settle(d, { pelvisTiltDeg: 10 });
    expect(out.map((c) => c.kind)).toContain('pelvic_tilt');
  });

  it("applique une hystérésis pour éviter le clignotement de l'alerte", () => {
    const d = new CompensationDetector();
    calibrate(d);
    expect(settle(d, { trunkLeanDeg: 12 }).length).toBe(1);
    // 9° : sous le seuil de déclenchement (10°) mais au-dessus du seuil de relâche (7°).
    expect(settle(d, { trunkLeanDeg: 9 }).length).toBe(1);
    expect(settle(d, { trunkLeanDeg: 3 })).toEqual([]);
  });

  it('recapture la référence sur demande', () => {
    const d = new CompensationDetector();
    calibrate(d);
    d.resetBaseline();
    expect(d.hasBaseline).toBe(false);
    calibrate(d, { trunkLeanDeg: 20 });
    expect(settle(d, { trunkLeanDeg: 20 })).toEqual([]);
  });
});
