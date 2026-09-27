import { POSE_LANDMARK_COUNT, PoseLandmark as L, type Vec3 } from '@core';

/**
 * Patient simulé : génère, image par image, les 33 repères qu'aurait produits
 * MediaPipe sur une vraie vidéo, et dessine un mannequin correspondant.
 * Permet de tester toute l'application sans caméra ni vidéo.
 */
export type DemoScenario = 'rehab' | 'posture_front' | 'posture_profile';

export const DEMO_SCENARIO_LABELS: Record<DemoScenario, string> = {
  rehab: 'Rééducation (profil)',
  posture_front: 'Posture (face)',
  posture_profile: 'Posture (profil)',
};

export interface DemoFrame {
  /** Coordonnées normalisées [0-1] dans l'image (comme MediaPipe). */
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
  /** Coordonnées "monde" en mètres, centrées sur le bassin, y vers le bas. */
  world: Vec3[];
  /** Légende de l'exercice en cours. */
  caption: string;
}

type P = { x: number; y: number };
type Side = 'L' | 'R';

const DEG = Math.PI / 180;
const add = (a: P, len: number, angleFromDownDeg: number): P => ({
  // angle mesuré depuis la verticale descendante, positif vers l'avant (+x)
  x: a.x + len * Math.sin(angleFromDownDeg * DEG),
  y: a.y - len * Math.cos(angleFromDownDeg * DEG),
});

/** Profil d'une répétition : 0 → 1 → 0, avec plateau au sommet. */
function repShape(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.4) return 0.5 - 0.5 * Math.cos((t / 0.4) * Math.PI);
  if (t < 0.55) return 1;
  return 0.5 + 0.5 * Math.cos(((t - 0.55) / 0.45) * Math.PI);
}

interface Pose {
  trunkLean: number; // ° vers l'avant
  kneeFlex: Record<Side, number>;
  shoulderElev: Record<Side, number>;
  elbowFlex: Record<Side, number>;
  headForward: number; // ° antéposition
  caption: string;
}

const NEUTRAL: Pose = {
  trunkLean: 0,
  kneeFlex: { L: 0, R: 0 },
  shoulderElev: { L: 4, R: 4 },
  elbowFlex: { L: 8, R: 8 },
  headForward: 6,
  caption: 'Position de repos — calibrage',
};

const REP_S = 2.6;
/** Programme de rééducation (boucle de 38 s). `scale` réduit les amplitudes (séance antérieure). */
function rehabPose(time: number, scale: number): Pose {
  const T = 38;
  const t = time % T;
  const p: Pose = { ...NEUTRAL, kneeFlex: { ...NEUTRAL.kneeFlex }, shoulderElev: { ...NEUTRAL.shoulderElev }, elbowFlex: { ...NEUTRAL.elbowFlex } };
  const rep = (start: number, count: number) => {
    const local = t - start;
    if (local < 0 || local >= count * REP_S) return null;
    return { k: repShape((local % REP_S) / REP_S), i: Math.floor(local / REP_S) };
  };
  let r;
  if ((r = rep(2, 3))) {
    p.kneeFlex.R = r.k * 122 * scale;
    p.caption = `Flexion genou droit — répétition ${r.i + 1}/3`;
  } else if ((r = rep(10.5, 3))) {
    p.kneeFlex.L = r.k * 136 * scale;
    p.caption = `Flexion genou gauche — répétition ${r.i + 1}/3`;
  } else if ((r = rep(19, 3))) {
    p.elbowFlex.R = 8 + r.k * 134 * scale;
    // 3e répétition : le patient compense en penchant le tronc.
    if (r.i === 2) {
      p.trunkLean = r.k * 18;
      p.caption = 'Flexion coude droit — compensation du tronc !';
    } else {
      p.caption = `Flexion coude droit — répétition ${r.i + 1}/3`;
    }
  } else if ((r = rep(27.5, 3))) {
    p.shoulderElev.R = 4 + r.k * 160 * scale;
    p.elbowFlex.R = 8 + r.k * 4;
    p.caption = `Élévation épaule droite — répétition ${r.i + 1}/3`;
  } else if (t >= 2) {
    p.caption = 'Pause';
  }
  return p;
}

// --- Construction du squelette ------------------------------------------------

interface Built {
  pts: P[]; // mètres, x avant (profil) ou latéral (face), y vers le haut
  z: number[]; // profondeur (mètres) pour les coordonnées monde
  vis: number[];
}

function emptyBuilt(): Built {
  return {
    pts: Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0, y: 1.5 })),
    z: new Array(POSE_LANDMARK_COUNT).fill(0),
    vis: new Array(POSE_LANDMARK_COUNT).fill(0.99),
  };
}

const IDX = {
  L: { sh: L.leftShoulder, el: L.leftElbow, wr: L.leftWrist, pi: L.leftPinky, ix: L.leftIndex, th: L.leftThumb, hip: L.leftHip, kn: L.leftKnee, an: L.leftAnkle, he: L.leftHeel, ft: L.leftFootIndex, ear: L.leftEar, eye: L.leftEye, eyeI: L.leftEyeInner, eyeO: L.leftEyeOuter, mouth: L.mouthLeft },
  R: { sh: L.rightShoulder, el: L.rightElbow, wr: L.rightWrist, pi: L.rightPinky, ix: L.rightIndex, th: L.rightThumb, hip: L.rightHip, kn: L.rightKnee, an: L.rightAnkle, he: L.rightHeel, ft: L.rightFootIndex, ear: L.rightEar, eye: L.rightEye, eyeI: L.rightEyeInner, eyeO: L.rightEyeOuter, mouth: L.mouthRight },
} as const;

/**
 * Vue de profil (repère local : x vers l'avant du patient). À l'image, le
 * patient regarde vers la gauche : son côté droit fait face à la caméra.
 */
function buildProfile(pose: Pose): Built {
  const b = emptyBuilt();
  const hipC = { x: 0, y: 0.95 };
  const trunkTop = add(hipC, 0.52, 180 - pose.trunkLean); // vers le haut, penché vers l'avant
  for (const side of ['L', 'R'] as const) {
    const I = IDX[side];
    const off = side === 'L' ? -0.025 : 0; // côté éloigné légèrement décalé
    const zSide = side === 'L' ? 0.1 : -0.1;
    const hip = { x: hipC.x + off, y: hipC.y };
    const knee = add(hip, 0.45, 0);
    const ankle = add(knee, 0.43, -pose.kneeFlex[side]);
    const heel = add(ankle, 0.07, -pose.kneeFlex[side] - 60);
    const foot = add(ankle, 0.17, -pose.kneeFlex[side] + 95);
    const sh = { x: trunkTop.x + off, y: trunkTop.y };
    const el = add(sh, 0.3, pose.shoulderElev[side] + pose.trunkLean);
    const wr = add(el, 0.27, pose.shoulderElev[side] + pose.elbowFlex[side] + pose.trunkLean);
    const handDir = pose.shoulderElev[side] + pose.elbowFlex[side] + pose.trunkLean;
    Object.assign(b.pts, {
      [I.hip]: hip, [I.kn]: knee, [I.an]: ankle, [I.he]: heel, [I.ft]: foot,
      [I.sh]: sh, [I.el]: el, [I.wr]: wr,
      [I.pi]: add(wr, 0.08, handDir - 8), [I.ix]: add(wr, 0.09, handDir + 4), [I.th]: add(wr, 0.06, handDir + 25),
    });
    for (const i of [I.hip, I.kn, I.an, I.he, I.ft, I.sh, I.el, I.wr, I.pi, I.ix, I.th]) b.z[i] = zSide;
    const neck = add(sh, 0.12, 180 + pose.headForward + pose.trunkLean);
    b.pts[I.ear] = { x: neck.x - 0.02 + off, y: neck.y + 0.1 };
    b.pts[I.eye] = { x: neck.x + 0.07, y: neck.y + 0.13 };
    b.pts[I.eyeI] = { x: neck.x + 0.08, y: neck.y + 0.13 };
    b.pts[I.eyeO] = { x: neck.x + 0.06, y: neck.y + 0.13 };
    b.pts[I.mouth] = { x: neck.x + 0.08, y: neck.y + 0.04 };
    if (side === 'R') b.pts[L.nose] = { x: neck.x + 0.11, y: neck.y + 0.09 };
  }
  return b;
}

/** Vue de face : patient face caméra (sa gauche à droite de l'image), petits défauts posturaux. */
function buildFront(time: number): Built {
  const b = emptyBuilt();
  const sway = Math.sin(time * 0.9) * 0.006;
  for (const side of ['L', 'R'] as const) {
    const I = IDX[side];
    const s = side === 'L' ? 1 : -1;
    const hip = { x: s * 0.15 + sway, y: 0.95 + (side === 'L' ? 0.012 : -0.012) }; // bassin : gauche plus haut
    const knee = { x: hip.x - s * 0.01, y: 0.5 };
    const ankle = { x: knee.x, y: 0.08 };
    const sh = { x: s * 0.2 + sway * 1.8 + 0.018, y: 1.47 + (side === 'L' ? 0.018 : -0.018) }; // épaule droite basse
    const el = { x: sh.x + s * 0.05, y: sh.y - 0.3 };
    const wr = { x: el.x + s * 0.02, y: el.y - 0.27 };
    Object.assign(b.pts, {
      [I.hip]: hip, [I.kn]: knee, [I.an]: ankle,
      [I.he]: { x: ankle.x, y: 0.04 }, [I.ft]: { x: ankle.x + s * 0.04, y: 0.02 },
      [I.sh]: sh, [I.el]: el, [I.wr]: wr,
      [I.pi]: { x: wr.x + s * 0.02, y: wr.y - 0.08 }, [I.ix]: { x: wr.x, y: wr.y - 0.09 }, [I.th]: { x: wr.x - s * 0.02, y: wr.y - 0.06 },
      [I.ear]: { x: s * 0.075 + 0.03, y: 1.66 + (side === 'L' ? 0.006 : -0.006) },
      [I.eye]: { x: s * 0.035 + 0.03, y: 1.7 + (side === 'L' ? 0.004 : -0.004) },
      [I.eyeI]: { x: s * 0.02 + 0.03, y: 1.7 }, [I.eyeO]: { x: s * 0.05 + 0.03, y: 1.7 },
      [I.mouth]: { x: s * 0.025 + 0.03, y: 1.6 },
    });
  }
  b.pts[L.nose] = { x: 0.03, y: 1.65 };
  return b;
}

// --- Projection & dessin --------------------------------------------------------

export const DEMO_IMAGE = { width: 1280, height: 720 };
const PX_PER_M = 360;
const ORIGIN = { x: 600, y: 700 };

/** `mirror` : en profil, l'avant du patient est orienté vers la gauche de l'image. */
function toImage(p: P, mirror: boolean): P {
  return { x: ORIGIN.x + (mirror ? -p.x : p.x) * PX_PER_M, y: ORIGIN.y - p.y * PX_PER_M };
}

let noiseSeed = 1;
function noise(): number {
  noiseSeed = (noiseSeed * 16807) % 2147483647;
  return (noiseSeed / 2147483647 - 0.5) * 2;
}

export function demoPoseAt(scenario: DemoScenario, timeS: number, amplitudeScale = 1): { built: Built; caption: string } {
  if (scenario === 'posture_front') return { built: buildFront(timeS), caption: 'Station debout — vue de face' };
  if (scenario === 'posture_profile') {
    const pose = { ...NEUTRAL, headForward: 24, trunkLean: 3, caption: 'Station debout — vue de profil' };
    pose.trunkLean += Math.sin(timeS * 0.9) * 0.6;
    return { built: buildProfile(pose), caption: pose.caption };
  }
  const pose = rehabPose(timeS, amplitudeScale);
  return { built: buildProfile(pose), caption: pose.caption };
}

export function demoFrame(scenario: DemoScenario, timeS: number, amplitudeScale = 1): DemoFrame {
  const { built, caption } = demoPoseAt(scenario, timeS, amplitudeScale);
  const hipMid = { x: (built.pts[L.leftHip].x + built.pts[L.rightHip].x) / 2, y: built.pts[L.leftHip].y };
  const jitter = 1.2; // px : bruit de détection réaliste
  const landmarks = built.pts.map((p, i) => {
    const img = toImage(p, scenario !== 'posture_front');
    return {
      x: (img.x + noise() * jitter) / DEMO_IMAGE.width,
      y: (img.y + noise() * jitter) / DEMO_IMAGE.height,
      z: built.z[i],
      visibility: built.vis[i],
    };
  });
  const world = built.pts.map((p, i) => ({ x: p.x - hipMid.x, y: -(p.y - hipMid.y), z: built.z[i] }));
  return { landmarks, world, caption };
}

/** Dessine la scène (mur quadrillé de posturologie, sol, mannequin) dans un canvas 1280×720. */
export function drawDemo(ctx: CanvasRenderingContext2D, scenario: DemoScenario, timeS: number): void {
  const { width: W, height: H } = DEMO_IMAGE;
  const { built } = demoPoseAt(scenario, timeS);
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#2b3445');
  wall.addColorStop(1, '#1d2431');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // Quadrillage de posturologie (carreaux de 10 cm).
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const step = PX_PER_M * 0.1;
  for (let x = ORIGIN.x % step; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ORIGIN.y);
    ctx.stroke();
  }
  for (let y = ORIGIN.y; y > 0; y -= step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#151a22';
  ctx.fillRect(0, ORIGIN.y, W, H - ORIGIN.y);

  const pt = (i: number) => toImage(built.pts[i], scenario !== 'posture_front');
  const limb = (a: number, b: number, w: number, color: string) => {
    const pa = pt(a);
    const pb = pt(b);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  };
  const front = scenario === 'posture_front';
  // Côté éloigné d'abord (plus sombre), puis le tronc, puis le côté proche.
  const sides: Side[] = front ? ['L', 'R'] : ['L', 'R'];
  const skin = '#d9a988';
  const cloth = '#3f6c8f';
  const shorts = '#27313f';
  const draw = (side: Side, dim: boolean) => {
    const I = IDX[side];
    const f = (c: string) => (dim ? shade(c, -0.28) : c);
    limb(I.hip, I.kn, 34, f(shorts));
    limb(I.kn, I.an, 26, f(skin));
    limb(I.an, I.ft, 16, f('#e5e7eb'));
    limb(I.an, I.he, 16, f('#e5e7eb'));
    limb(I.sh, I.el, 22, f(cloth));
    limb(I.el, I.wr, 18, f(skin));
    limb(I.wr, I.ix, 12, f(skin));
  };
  if (!front) draw('L', true);
  // Tronc.
  const ls = pt(L.leftShoulder), rs = pt(L.rightShoulder), lh = pt(L.leftHip), rh = pt(L.rightHip);
  ctx.fillStyle = cloth;
  ctx.strokeStyle = cloth;
  ctx.lineWidth = front ? 30 : 64;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.lineTo(rh.x, rh.y);
  ctx.lineTo(lh.x, lh.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Tête.
  const nose = pt(L.nose);
  const ear = pt(front ? L.leftEar : L.rightEar);
  const headC = front ? { x: nose.x, y: nose.y - 6 } : { x: (nose.x + ear.x) / 2 + 4, y: ear.y - 6 };
  const neckBase = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  ctx.strokeStyle = skin;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(neckBase.x, neckBase.y);
  ctx.lineTo(headC.x, headC.y + 30);
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(headC.x, headC.y, 40, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3426';
  ctx.beginPath();
  ctx.ellipse(headC.x + (front ? 0 : 10), headC.y - 22, 40, 26, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  for (const s of sides) if (front || s === 'R') draw(s, false);
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + amount))));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
