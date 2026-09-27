import { useEffect, useRef, useState } from 'react';

import {
  JOINTS,
  JOINTS_BY_ID,
  MIN_MEASURED_RANGE,
  PoseLandmark as L,
  SKELETON_CONNECTIONS,
  SKELETON_POINTS,
  ghostFrameAt,
  progressToward,
  projectGhost,
  targetPoint,
  type Compensation,
  type GhostTrack,
  type JointAnalysis,
  type Point2,
  type PostureAnalysis,
  type ScreenLandmark,
} from '@core';
import { fmtJoint, jointTone } from './format';

const MIN_VIS = 0.5;
const ARC_R = 38;

function arcPath(a: Point2, b: Point2, c: Point2, r: number): string | null {
  const n1 = Math.hypot(a.x - b.x, a.y - b.y);
  const n2 = Math.hypot(c.x - b.x, c.y - b.y);
  if (!n1 || !n2) return null;
  const u1 = { x: (a.x - b.x) / n1, y: (a.y - b.y) / n1 };
  const u2 = { x: (c.x - b.x) / n2, y: (c.y - b.y) / n2 };
  const sweep = u1.x * u2.y - u1.y * u2.x > 0 ? 1 : 0;
  return `M ${b.x} ${b.y} L ${b.x + r * u1.x} ${b.y + r * u1.y} A ${r} ${r} 0 0 ${sweep} ${b.x + r * u2.x} ${b.y + r * u2.y} Z`;
}

function labelPos(a: Point2, b: Point2, c: Point2, d: number): Point2 {
  const n1 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const n2 = Math.hypot(c.x - b.x, c.y - b.y) || 1;
  const bx = (a.x - b.x) / n1 + (c.x - b.x) / n2;
  const by = (a.y - b.y) / n1 + (c.y - b.y) / n2;
  const nb = Math.hypot(bx, by);
  const dir = nb < 1e-3 ? { x: -(a.y - b.y) / n1, y: (a.x - b.x) / n1 } : { x: -bx / nb, y: -by / nb };
  return { x: b.x + dir.x * d, y: b.y + dir.y * d };
}

export function SkeletonLayer({
  landmarks,
  analysis,
  compensations,
  showAngles,
}: {
  landmarks: ScreenLandmark[] | null;
  analysis: JointAnalysis;
  compensations: Compensation[];
  showAngles: boolean;
}) {
  if (!landmarks) return null;
  const ok = (i: number) => (landmarks[i]?.visibility ?? 0) >= MIN_VIS;
  const flagged = new Set(compensations.flatMap((c) => c.landmarks));
  const placed: Point2[] = [];
  return (
    <g>
      {SKELETON_CONNECTIONS.map(([i, j]) =>
        ok(i) && ok(j) ? (
          <line
            key={`l${i}-${j}`}
            className={flagged.has(i) && flagged.has(j) ? 'bone bone-flagged' : 'bone'}
            x1={landmarks[i].x}
            y1={landmarks[i].y}
            x2={landmarks[j].x}
            y2={landmarks[j].y}
          />
        ) : null,
      )}
      {SKELETON_POINTS.map((i) => (ok(i) ? <circle key={`p${i}`} className="joint-dot" cx={landmarks[i].x} cy={landmarks[i].y} r={5} /> : null))}
      {showAngles &&
        // Articulation active d'abord ; une étiquette qui en chevauche une autre est omise
        // (en vue de profil, gauche et droite se superposent).
        [...JOINTS].sort((a, b) => Number(b.id === analysis.activeJointId) - Number(a.id === analysis.activeJointId)).map((def) => {
          const m = analysis.joints[def.id];
          if (!m.tracked || m.value === null) return null;
          const active = analysis.activeJointId === def.id;
          const moved = m.peak !== null && m.min !== null && m.peak - m.min >= MIN_MEASURED_RANGE;
          if (!active && !moved) return null;
          const a = landmarks[def.proximal];
          const b = landmarks[def.vertex];
          const c = landmarks[def.distal];
          const arc = arcPath(a, b, c, ARC_R);
          const lp = labelPos(a, b, c, ARC_R + 30);
          const tone = jointTone(m, active);
          const collides = placed.some((q) => Math.hypot(q.x - lp.x, q.y - lp.y) < 44);
          if (collides && !active) return null;
          placed.push(lp);
          return (
            <g key={def.id} className={`angle tone-${tone}`}>
              {arc && <path className="angle-arc" d={arc} />}
              <line className="angle-seg" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line className="angle-seg" x1={b.x} y1={b.y} x2={c.x} y2={c.y} />
              <circle className="angle-vertex" cx={b.x} cy={b.y} r={8} />
              <text className={active ? 'angle-label angle-label-active' : 'angle-label'} x={lp.x} y={lp.y + 10} textAnchor="middle">
                {fmtJoint(def.id, m.value)}°
              </text>
            </g>
          );
        })}
      {compensations.map((comp) =>
        comp.landmarks.filter(ok).map((i) => <circle key={`c${comp.kind}${i}`} className="compensation-ring" cx={landmarks[i].x} cy={landmarks[i].y} r={34} />),
      )}
    </g>
  );
}

export function GhostLayer({ track, live, view }: { track: GhostTrack; live: ScreenLandmark[] | null; view: { width: number; height: number } }) {
  const start = useRef(performance.now());
  const [, tick] = useState(0);
  useEffect(() => {
    start.current = performance.now();
    const id = setInterval(() => tick((t) => t + 1), 66);
    return () => clearInterval(id);
  }, [track]);
  const pts = projectGhost(ghostFrameAt(track, performance.now() - start.current), live, view);
  const ok = (i: number) => (pts[i]?.visibility ?? 0) >= MIN_VIS;
  return (
    <g className="ghost">
      {SKELETON_CONNECTIONS.map(([i, j]) =>
        ok(i) && ok(j) ? <line key={`g${i}-${j}`} x1={pts[i].x} y1={pts[i].y} x2={pts[j].x} y2={pts[j].y} /> : null,
      )}
      {SKELETON_POINTS.map((i) => (ok(i) ? <circle key={`gp${i}`} cx={pts[i].x} cy={pts[i].y} r={8} /> : null))}
    </g>
  );
}

export function PostureLayer({ posture, landmarks }: { posture: PostureAnalysis | null; landmarks: ScreenLandmark[] | null }) {
  if (!posture || !landmarks) return null;
  const tone = (key: string) => (posture.metrics.find((m) => m.key === key)?.status === 'warn' ? 'warn' : 'ok');
  const ext = (a: ScreenLandmark, b: ScreenLandmark, k = 0.4) => ({
    x1: a.x + (a.x - b.x) * k,
    y1: a.y + (a.y - b.y) * k,
    x2: b.x + (b.x - a.x) * k,
    y2: b.y + (b.y - a.y) * k,
  });
  return (
    <g>
      {posture.plumbLine && (
        <line
          className="plumb"
          x1={posture.plumbLine.top.x}
          y1={posture.plumbLine.top.y - 40}
          x2={posture.plumbLine.bottom.x}
          y2={posture.plumbLine.bottom.y + 16}
        />
      )}
      {posture.view === 'front' && (
        <>
          <line className={`girdle girdle-${tone('shoulders')}`} {...ext(landmarks[L.leftShoulder], landmarks[L.rightShoulder])} />
          <line className={`girdle girdle-${tone('pelvis')}`} {...ext(landmarks[L.leftHip], landmarks[L.rightHip])} />
        </>
      )}
    </g>
  );
}

/** Étoile-cible du mode pédiatrie ; renvoie aussi la progression pour la fusée. */
export function pediatricTarget(analysis: JointAnalysis, landmarks: ScreenLandmark[] | null, targetValue: number | null) {
  const id = analysis.activeJointId;
  const m = id ? analysis.joints[id] : null;
  if (!id || !m || targetValue === null) return { progress: 0, target: null, tip: null };
  const def = JOINTS_BY_ID[id];
  const progress = m.value !== null ? progressToward(m.value, m.min ?? 0, targetValue) : 0;
  if (!landmarks || !m.tracked) return { progress, target: null, tip: null };
  const target = targetPoint(def, landmarks[def.proximal], landmarks[def.vertex], landmarks[def.distal], targetValue);
  return { progress, target, tip: landmarks[def.distal] };
}

export function PediatricLayer({ target, tip, reached }: { target: Point2 | null; tip: Point2 | null; reached: boolean }) {
  if (!target || !tip) return null;
  return (
    <g className="kid-target">
      <line className="kid-trail" x1={tip.x} y1={tip.y} x2={target.x} y2={target.y} />
      <circle className="kid-halo" cx={target.x} cy={target.y} r={44} />
      <text x={target.x} y={target.y + 18} textAnchor="middle" fontSize={52}>
        {reached ? '🌟' : '⭐'}
      </text>
    </g>
  );
}
