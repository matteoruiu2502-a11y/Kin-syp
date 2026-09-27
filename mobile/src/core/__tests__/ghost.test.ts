import { GhostRecorder, bodyFrame, ghostFrameAt, projectGhost } from '../ghost';
import { PoseLandmark as L } from '../landmarks';
import { makeFrame } from './poseFixtures';

describe('ghost', () => {
  it("s'aligne sur le patient en direct (position et échelle)", () => {
    const recorder = new GhostRecorder(30);
    const rec = makeFrame({ rightElbowFlexion: 90 });
    recorder.push(rec.landmarks, 0);
    recorder.push(rec.landmarks, 100);
    const track = recorder.toTrack()!;

    // Patient en direct deux fois plus grand et décalé.
    const live = makeFrame().landmarks.map((p) => ({ ...p, x: p.x * 2 + 100, y: p.y * 2 - 50 }));
    const projected = projectGhost(ghostFrameAt(track, 0), live, { width: 2000, height: 2000 });
    const expectedWrist = rec.landmarks[L.rightWrist];
    expect(projected[L.rightWrist].x).toBeCloseTo(expectedWrist.x * 2 + 100, 0);
    expect(projected[L.rightWrist].y).toBeCloseTo(expectedWrist.y * 2 - 50, 0);
  });

  it('conserve uniquement la fenêtre temporelle récente, à la cadence demandée', () => {
    const recorder = new GhostRecorder(10, 1000);
    for (let t = 0; t <= 3000; t += 33) recorder.push(makeFrame().landmarks, t);
    const track = recorder.toTrack()!;
    expect(track.durationMs).toBeLessThanOrEqual(1000);
    expect(track.frames.length).toBeLessThanOrEqual(11);
  });

  it('rejoue en boucle', () => {
    const recorder = new GhostRecorder(100);
    recorder.push(makeFrame({ rightElbowFlexion: 0 }).landmarks, 0);
    recorder.push(makeFrame({ rightElbowFlexion: 90 }).landmarks, 500);
    recorder.push(makeFrame({ rightElbowFlexion: 0 }).landmarks, 1000);
    const track = recorder.toTrack()!;
    expect(ghostFrameAt(track, 600).t).toBe(500);
    expect(ghostFrameAt(track, 1600).t).toBe(500);
  });

  it("n'enregistre rien sans patient visible", () => {
    const f = makeFrame({ visibility: 0.1 });
    expect(bodyFrame(f.landmarks)).toBeNull();
    const recorder = new GhostRecorder();
    recorder.push(f.landmarks, 0);
    expect(recorder.length).toBe(0);
  });
});
