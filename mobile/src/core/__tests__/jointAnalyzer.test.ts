import { JointAnalyzer } from '../jointAnalyzer';
import { PoseLandmark } from '../landmarks';
import { makeFrame, worldFromFrame } from './poseFixtures';

const FRAME_MS = 33;

describe('JointAnalyzer', () => {
  it('mesure la flexion des coudes et genoux', () => {
    const analyzer = new JointAnalyzer();
    const result = analyzer.process(
      makeFrame({ rightElbowFlexion: 90, leftElbowFlexion: 30, rightKneeFlexion: 45, leftKneeFlexion: 0 }),
    );
    expect(result.joints.elbow_right.flexion).toBeCloseTo(90, 5);
    expect(result.joints.elbow_left.flexion).toBeCloseTo(30, 5);
    expect(result.joints.knee_right.flexion).toBeCloseTo(45, 5);
    expect(result.joints.knee_left.flexion).toBeCloseTo(0, 5);
    expect(result.joints.elbow_right.tracked).toBe(true);
  });

  it('capture automatiquement la flexion maximale et la meilleure extension', () => {
    const analyzer = new JointAnalyzer();
    let t = 0;
    // Flexion 10° → 130° → 20°, 30 FPS.
    const sequence = [
      ...Array.from({ length: 30 }, (_, i) => 10 + i * 4),
      ...Array.from({ length: 30 }, () => 130),
      ...Array.from({ length: 30 }, (_, i) => 130 - i * 3.7),
      ...Array.from({ length: 30 }, () => 20),
    ];
    let last = analyzer.process(makeFrame({ rightElbowFlexion: sequence[0], timestampMs: t }));
    for (const flex of sequence.slice(1)) {
      t += FRAME_MS;
      last = analyzer.process(makeFrame({ rightElbowFlexion: flex, timestampMs: t }));
    }
    const elbow = last.joints.elbow_right;
    expect(elbow.peakFlexion).toBeGreaterThan(128);
    expect(elbow.peakFlexion).toBeLessThanOrEqual(130.01);
    expect(elbow.minFlexion).toBeLessThan(12);
    expect(elbow.flexion).toBeCloseTo(20, 0);
  });

  it('remet les extrêmes à la valeur courante', () => {
    const analyzer = new JointAnalyzer();
    analyzer.process(makeFrame({ rightElbowFlexion: 120, timestampMs: 0 }));
    analyzer.resetPeaks();
    const r = analyzer.process(makeFrame({ rightElbowFlexion: 120, timestampMs: 33 }));
    expect(r.joints.elbow_right.peakFlexion).toBeCloseTo(120, 3);
    expect(r.joints.elbow_right.minFlexion).toBeCloseTo(120, 3);
  });

  it('ignore les repères peu visibles puis oublie la mesure après le délai', () => {
    const analyzer = new JointAnalyzer({ lostTimeoutMs: 500 });
    analyzer.process(makeFrame({ rightElbowFlexion: 60, timestampMs: 0 }));

    const occluded = makeFrame({ rightElbowFlexion: 60, timestampMs: 100 });
    occluded.landmarks[PoseLandmark.rightWrist].visibility = 0.1;
    let r = analyzer.process(occluded);
    expect(r.joints.elbow_right.tracked).toBe(false);
    expect(r.joints.elbow_right.flexion).toBeCloseTo(60, 3); // valeur conservée brièvement

    occluded.timestampMs = 700;
    r = analyzer.process(occluded);
    expect(r.joints.elbow_right.flexion).toBeNull();
    expect(r.joints.elbow_left.tracked).toBe(true);
  });

  it("signale un mouvement hors du plan de la caméra et n'en retient pas le pic", () => {
    const analyzer = new JointAnalyzer();
    const inPlane = makeFrame({ rightElbowFlexion: 20, timestampMs: 0 });
    inPlane.worldLandmarks = worldFromFrame(inPlane);
    expect(analyzer.process(inPlane).joints.elbow_right.outOfPlane).toBe(false);

    // Le poignet part vers la caméra : l'angle 2D reste faible, le 3D est fort.
    const toward = makeFrame({ rightElbowFlexion: 20, timestampMs: 33 });
    toward.worldLandmarks = worldFromFrame(toward, { [PoseLandmark.rightWrist]: -0.3 });
    const r = analyzer.process(toward);
    expect(r.joints.elbow_right.outOfPlane).toBe(true);
    expect(r.joints.elbow_right.peakFlexion).toBeCloseTo(20, 3);
  });

  it("met en avant l'articulation en mouvement", () => {
    const analyzer = new JointAnalyzer();
    let r = analyzer.process(makeFrame({ timestampMs: 0 }));
    for (let i = 1; i <= 45; i++) {
      r = analyzer.process(
        makeFrame({ rightKneeFlexion: Math.min(i * 4, 120), timestampMs: i * FRAME_MS }),
      );
    }
    expect(r.activeJointId).toBe('knee_right');
    expect(r.focusLocked).toBe(false);
  });

  it('respecte le verrouillage manuel du focus', () => {
    const analyzer = new JointAnalyzer();
    analyzer.setFocus('elbow_left');
    let r = analyzer.process(makeFrame({ timestampMs: 0 }));
    for (let i = 1; i <= 45; i++) {
      r = analyzer.process(makeFrame({ rightKneeFlexion: i * 2, timestampMs: i * FRAME_MS }));
    }
    expect(r.activeJointId).toBe('elbow_left');
    expect(r.focusLocked).toBe(true);
  });
});
