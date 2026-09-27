import { PoseLandmark as L } from '../landmarks';
import { analyzePosture, detectView, PostureSmoother } from '../posture';
import { makeFrame } from './poseFixtures';

describe('analyzePosture — vue de face', () => {
  it('détecte la vue de face', () => {
    expect(detectView(makeFrame().landmarks)).toBe('front');
  });

  it('mesure une épaule plus haute', () => {
    const f = makeFrame();
    f.landmarks[L.leftShoulder].y -= 20; // épaule gauche plus haute
    const res = analyzePosture(f.landmarks)!;
    const shoulders = res.metrics.find((m) => m.key === 'shoulders')!;
    expect(shoulders.value).toBeGreaterThan(5);
    expect(shoulders.status).toBe('warn');
    expect(shoulders.detail).toContain('gauche');
  });

  it('trouve un bassin horizontal et un tronc centré sur une posture neutre', () => {
    const res = analyzePosture(makeFrame().landmarks)!;
    expect(res.metrics.find((m) => m.key === 'pelvis')!.status).toBe('ok');
    expect(res.metrics.find((m) => m.key === 'lateral_shift')!.status).toBe('ok');
    expect(res.plumbLine).not.toBeNull();
  });

  it('détecte une translation latérale du tronc vers la gauche du patient', () => {
    const res = analyzePosture(makeFrame({ trunkLeanDeg: 12 }).landmarks)!;
    const shift = res.metrics.find((m) => m.key === 'lateral_shift')!;
    expect(shift.status).toBe('warn');
    expect(shift.detail).toContain('gauche');
  });
});

describe('analyzePosture — vue de profil', () => {
  function profile(forwardHeadPx: number) {
    const f = makeFrame();
    // Épaules et hanches superposées (profil), patient tourné vers x+.
    const lm = f.landmarks;
    lm[L.rightShoulder] = { ...lm[L.leftShoulder], x: 500, visibility: 0.3 };
    lm[L.leftShoulder] = { ...lm[L.leftShoulder], x: 500 };
    lm[L.leftHip] = { ...lm[L.leftHip], x: 500 };
    lm[L.rightHip] = { ...lm[L.rightHip], x: 500, visibility: 0.3 };
    lm[L.leftAnkle] = { ...lm[L.leftAnkle], x: 500 };
    lm[L.leftEar] = { x: 500 + forwardHeadPx, y: lm[L.leftShoulder].y - 90, visibility: 0.99 };
    lm[L.nose] = { x: 540 + forwardHeadPx, y: lm[L.leftShoulder].y - 95, visibility: 0.99 };
    return lm;
  }

  it('reconnaît la vue de profil', () => {
    expect(detectView(profile(0))).toBe('profile');
  });

  it("signale l'antéposition de la tête", () => {
    const res = analyzePosture(profile(50))!;
    const head = res.metrics.find((m) => m.key === 'forward_head')!;
    expect(head.value).toBeGreaterThan(15);
    expect(head.status).toBe('warn');
  });

  it('valide une tête alignée', () => {
    const res = analyzePosture(profile(0))!;
    expect(res.metrics.find((m) => m.key === 'forward_head')!.status).toBe('ok');
  });
});

describe('PostureSmoother', () => {
  it('lisse les variations image par image', () => {
    const smoother = new PostureSmoother(0.2);
    const neutral = analyzePosture(makeFrame().landmarks)!;
    smoother.push(neutral);
    const f = makeFrame();
    f.landmarks[L.leftShoulder].y -= 40;
    const out = smoother.push(analyzePosture(f.landmarks)!);
    const raw = analyzePosture(f.landmarks)!.metrics.find((m) => m.key === 'shoulders')!.value;
    expect(out.metrics.find((m) => m.key === 'shoulders')!.value).toBeLessThan(raw);
  });
});
