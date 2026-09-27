import { RepetitionTracker, summarizeRepetitions, symmetries, symmetry } from '../sport';

describe('symmetry', () => {
  it('calcule le LSI et le côté déficitaire', () => {
    const s = symmetry('knee', 120, 135);
    expect(s.lsi).toBeCloseTo(88.9, 1);
    expect(s.asymmetryPercent).toBeCloseTo(11.1, 1);
    expect(s.weakerSide).toBe('left');
  });

  it('ne retient que les articulations mesurées des deux côtés', () => {
    const res = symmetries({ knee_left: 130, knee_right: 130, elbow_left: 140, elbow_right: null });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ kind: 'knee', lsi: 100, weakerSide: null });
  });
});

describe('RepetitionTracker', () => {
  function simulate(tracker: RepetitionTracker, reps: number, periodMs: number, amplitude: number) {
    const fps = 30;
    const frames = Math.round((periodMs / 1000) * fps);
    let t = 0;
    for (let r = 0; r < reps; r++) {
      for (let i = 0; i < frames; i++) {
        const phase = i / frames;
        tracker.push(5 + amplitude * Math.sin(Math.PI * phase), t);
        t += 1000 / fps;
      }
    }
    for (let i = 0; i < 10; i++) {
      tracker.push(5, t);
      t += 1000 / fps;
    }
  }

  it('compte les répétitions et mesure leur durée', () => {
    const tracker = new RepetitionTracker();
    simulate(tracker, 3, 2000, 100);
    expect(tracker.repetitions).toHaveLength(3);
    const summary = summarizeRepetitions('knee_right', tracker.repetitions)!;
    expect(summary.count).toBe(3);
    expect(summary.meanRange).toBeGreaterThan(95);
    // Durée hors zone de repos : un peu moins que la période.
    expect(summary.meanDurationS).toBeGreaterThan(1.5);
    expect(summary.meanDurationS).toBeLessThan(2.1);
  });

  it('mesure une vitesse plus élevée pour un mouvement plus rapide', () => {
    const slow = new RepetitionTracker();
    const fast = new RepetitionTracker();
    simulate(slow, 2, 3000, 90);
    simulate(fast, 2, 1000, 90);
    const s = summarizeRepetitions('knee_right', slow.repetitions)!;
    const f = summarizeRepetitions('knee_right', fast.repetitions)!;
    expect(f.meanPeakVelocity).toBeGreaterThan(s.meanPeakVelocity * 2);
  });

  it('ignore les petits mouvements parasites', () => {
    const tracker = new RepetitionTracker();
    simulate(tracker, 3, 1000, 12);
    expect(tracker.repetitions).toHaveLength(0);
  });
});
