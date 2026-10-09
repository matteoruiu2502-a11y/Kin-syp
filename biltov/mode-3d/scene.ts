// Construction de la scène : bâtiment Biltov « en coupe » (maquette d'architecte), pièces, mobilier et parking.
// Tout est généré par code avec des boîtes et cylindres (low-poly) : aucun modèle ni texture lourde à télécharger.
// La scène est reconstruite entièrement quand le thème, les droits ou les données changent (quelques centaines
// d'objets : reconstruction instantanée) ; les géométries partagées et le logo sont conservés.

import * as THREE from "three";
import type { SceneFacts } from "./badges";
import type { Palette } from "./theme";
import type { ZoneAccess, ZoneConfig } from "./zones";

export const WALL_H = 3.2; // hauteur des murs extérieurs (fond et gauche)
const PARTITION_H = 1.3; // cloisons basses entre les pièces : on voit à l'intérieur
const SLAB_H = 0.3;
const MAX_VANS = 8;

/** Géométries partagées par toutes les reconstructions (libérées au démontage). */
export const SHARED = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  plane: new THREE.PlaneGeometry(1, 1),
};

export type SceneZone = {
  config: ZoneConfig;
  access: ZoneAccess;
  /** volume invisible servant à détecter survol et clic */
  hit: THREE.Mesh;
  /** voile de couleur de marque sur le sol, visible au survol */
  glow: THREE.Mesh;
  /** point de l'étiquette (au-dessus de la pièce) et centre de la pièce, en coordonnées monde */
  anchor: THREE.Vector3;
  center: THREE.Vector3;
};

export type BuiltScene = {
  root: THREE.Group;
  zones: SceneZone[];
  /** cheminée : point d'émission de la fumée (ambiance) */
  chimney: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** centre du bâtiment (x), pour la vue de départ en portrait */
  buildingX: number;
  dispose: () => void;
};

type V3 = [number, number, number];

/** Position (x) du centre du bâtiment une fois la scène centrée : sert à la vue de départ en portrait. */
export function buildingCenterX(zones: ZoneConfig[]) {
  const xs = (l: ZoneConfig[]) => [Math.min(...l.map((z) => z.area[0])), Math.max(...l.map((z) => z.area[0] + z.area[2]))];
  const [a0, a1] = xs(zones);
  const [b0, b1] = xs(zones.filter((z) => !z.outdoor));
  return (b0 + b1) / 2 - (a0 + a1) / 2;
}

/** Matériaux mis en cache pendant une construction, libérés avec elle. */
function materials() {
  const cache = new Map<string, THREE.Material>();
  const get = (color: string, opts: { emissive?: number; transparent?: number } = {}) => {
    const key = `${color}|${opts.emissive ?? 0}|${opts.transparent ?? 1}`;
    let m = cache.get(key);
    if (!m) {
      const mat = new THREE.MeshLambertMaterial({ color });
      if (opts.emissive) {
        mat.emissive = new THREE.Color(color);
        mat.emissiveIntensity = opts.emissive;
      }
      if (opts.transparent !== undefined && opts.transparent < 1) {
        mat.transparent = true;
        mat.opacity = opts.transparent;
        mat.depthWrite = false;
      }
      cache.set(key, (m = mat));
    }
    return m;
  };
  return { get, extra: [] as THREE.Material[], dispose: () => [...cache.values()].forEach((m) => m.dispose()) };
}

export function buildScene(zones: ZoneConfig[], access: Record<string, ZoneAccess>, facts: SceneFacts, pal: Palette, logo: THREE.Texture | null): BuiltScene {
  const root = new THREE.Group();
  const mats = materials();

  // ── petits outils de construction ──
  /** Boîte posée : `at` = centre au sol (x, bas, z). */
  const box = (parent: THREE.Object3D, color: string | THREE.Material, size: V3, at: V3, o: { cast?: boolean; receive?: boolean; emissive?: number; rotY?: number } = {}) => {
    const m = new THREE.Mesh(SHARED.box, typeof color === "string" ? mats.get(color, { emissive: o.emissive }) : color);
    m.scale.set(...size);
    m.position.set(at[0], at[1] + size[1] / 2, at[2]);
    if (o.rotY) m.rotation.y = o.rotY;
    m.castShadow = o.cast ?? true;
    m.receiveShadow = o.receive ?? true;
    parent.add(m);
    return m;
  };
  const cyl = (parent: THREE.Object3D, color: string, r: number, h: number, at: V3, o: { rotX?: number; rotZ?: number } = {}) => {
    const m = new THREE.Mesh(SHARED.cyl, mats.get(color));
    m.scale.set(r * 2, h, r * 2);
    m.position.set(...at);
    if (o.rotX) m.rotation.x = o.rotX;
    if (o.rotZ) m.rotation.z = o.rotZ;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ── emprise : le bâtiment couvre les pièces intérieures ; la scène est centrée sur l'ensemble ──
  const indoor = zones.filter((z) => !z.outdoor);
  const span = (list: ZoneConfig[]) => ({
    minX: Math.min(...list.map((z) => z.area[0])),
    maxX: Math.max(...list.map((z) => z.area[0] + z.area[2])),
    minZ: Math.min(...list.map((z) => z.area[1])),
    maxZ: Math.max(...list.map((z) => z.area[1] + z.area[3])),
  });
  const all = span(zones);
  const b = span(indoor);
  const cx = (all.minX + all.maxX) / 2;
  const cz = (all.minZ + all.maxZ) / 2;
  root.position.set(-cx, 0, -cz);

  // sol extérieur
  box(root, pal.ground, [all.maxX - all.minX + 14, 0.2, all.maxZ - all.minZ + 12], [cx, -0.2, cz], { cast: false });
  // dalle du bâtiment
  box(root, pal.slab, [b.maxX - b.minX + 0.6, SLAB_H, b.maxZ - b.minZ + 0.6], [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2], { cast: false });

  // murs extérieurs : fond et gauche pleine hauteur (vue en coupe), avant et droite en muret
  const W = 0.25;
  const top = SLAB_H;
  box(root, pal.wall, [b.maxX - b.minX + W, WALL_H, W], [(b.minX + b.maxX) / 2, top, b.minZ - W / 2]);
  box(root, pal.wall, [W, WALL_H, b.maxZ - b.minZ], [b.minX - W / 2, top, (b.minZ + b.maxZ) / 2]);
  // bandeau de fenêtres sur le mur du fond
  for (let x = b.minX + 1.2; x < b.maxX - 1; x += 2.2) box(root, pal.glass, [1.4, 0.9, 0.06], [x + 0.7, top + 1.6, b.minZ + 0.02], { cast: false });
  // murets avant et droit, avec une ouverture d'entrée face au parking
  box(root, pal.wall, [b.maxX - b.minX, 0.45, W], [(b.minX + b.maxX) / 2, top, b.maxZ + W / 2]);
  const door = (b.minZ + b.maxZ) / 2;
  box(root, pal.wall, [W, 0.45, door - 0.9 - b.minZ], [b.maxX + W / 2, top, (b.minZ + door - 0.9) / 2]);
  box(root, pal.wall, [W, 0.45, b.maxZ - door - 0.9], [b.maxX + W / 2, top, (door + 0.9 + b.maxZ) / 2]);

  // enseigne avec le logo Biltov, posée sur le mur du fond, face à la caméra
  const signW = Math.min(8, b.maxX - b.minX - 1);
  const signH = signW / 4.2;
  const signFace = logo ? new THREE.MeshBasicMaterial({ map: logo }) : mats.get(pal.sign);
  if (logo) mats.extra.push(signFace);
  const side = mats.get(pal.dark ? "#1e293b" : "#e2e8f0");
  const sign = new THREE.Mesh(SHARED.box, [side, side, side, side, signFace, side]);
  sign.scale.set(signW, signH, 0.18);
  sign.position.set((b.minX + b.maxX) / 2, top + WALL_H + signH / 2 + 0.25, b.minZ - W / 2);
  sign.castShadow = true;
  root.add(sign);
  for (const dx of [-signW / 3, signW / 3]) box(root, pal.furnitureDark, [0.12, 0.3, 0.12], [sign.position.x + dx, top + WALL_H, b.minZ - W / 2]);
  sign.name = "logo";

  // cheminée d'aération (point de départ de la fumée d'ambiance)
  const chim = box(root, pal.furniture, [0.5, 1.1, 0.5], [b.minX + 0.6, top + WALL_H, b.minZ + 0.4]);
  const chimney = new THREE.Vector3(chim.position.x, top + WALL_H + 1.2, chim.position.z);

  // ── pièces ──
  const out: SceneZone[] = [];
  for (const z of zones) {
    const [x, zz, w, d] = z.area;
    const acc = access[z.id] ?? "locked";
    const dim = acc !== "ok";
    const g = new THREE.Group();
    g.name = z.id;
    root.add(g);
    const floorY = z.outdoor ? 0 : top;
    const c: V3 = [x + w / 2, floorY, zz + d / 2];

    // sol de la pièce (grisé si la pièce n'est pas accessible)
    if (!z.outdoor) box(g, dim ? pal.soon : pal.floor, [w - 0.08, 0.04, d - 0.08], [c[0], floorY, c[2]], { cast: false });

    // cloisons basses vers les pièces voisines (côté droit et avant), avec une porte au milieu
    if (!z.outdoor) {
      if (x + w < b.maxX - 0.01) {
        const gap = 1.1;
        const l = (d - gap) / 2;
        box(g, pal.partition, [0.12, PARTITION_H, l], [x + w, floorY, zz + l / 2]);
        box(g, pal.partition, [0.12, PARTITION_H, l], [x + w, floorY, zz + d - l / 2]);
      }
      if (zz + d < b.maxZ - 0.01) {
        const gap = 1.1;
        const l = (w - gap) / 2;
        box(g, pal.partition, [l, PARTITION_H, 0.12], [x + l / 2, floorY, zz + d]);
        box(g, pal.partition, [l, PARTITION_H, 0.12], [x + w - l / 2, floorY, zz + d]);
      }
    }

    decorate(z, g, { x, z: zz, w, d, y: floorY + 0.04 }, dim, facts, pal, { box, cyl, mat: mats.get });

    // voile de survol (couleur de marque) et volume de détection
    const glowMat = new THREE.MeshBasicMaterial({ color: pal.brand, transparent: true, opacity: 0, depthWrite: false });
    mats.extra.push(glowMat);
    const glow = new THREE.Mesh(SHARED.plane, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.scale.set(w - 0.1, d - 0.1, 1);
    glow.position.set(c[0], floorY + 0.07, c[2]);
    glow.renderOrder = 2;
    g.add(glow);

    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    mats.extra.push(hitMat);
    const hit = new THREE.Mesh(SHARED.box, hitMat);
    hit.scale.set(w, 2.6, d);
    hit.position.set(c[0], floorY + 1.3, c[2]);
    hit.userData.zone = z.id;
    g.add(hit);

    // la racine n'est que translatée : coordonnées monde = locales + décalage de centrage
    const anchor = new THREE.Vector3(c[0], floorY + 1.4, c[2]).add(root.position);
    const center = new THREE.Vector3(c[0], floorY, c[2]).add(root.position);
    out.push({ config: z, access: acc, hit, glow, anchor, center });
  }

  // quelques arbres sobres autour du bâtiment
  for (const [tx, tz] of [[b.minX - 2, b.maxZ + 1.5], [b.minX - 2.4, b.minZ + 1], [all.maxX + 1.6, all.maxZ + 0.8], [all.maxX + 1.8, all.minZ + 1.5]]) {
    cyl(root, pal.furnitureDark, 0.12, 0.8, [tx, 0.4, tz]);
    const crown = new THREE.Mesh(SHARED.sphere, mats.get(pal.dark ? "#3f4f46" : "#b7c4bc"));
    crown.scale.set(1.5, 1.7, 1.5);
    crown.position.set(tx, 1.5, tz);
    crown.castShadow = true;
    root.add(crown);
  }

  return {
    root,
    zones: out,
    chimney: chimney.add(root.position),
    bounds: { minX: all.minX - cx, maxX: all.maxX - cx, minZ: all.minZ - cz, maxZ: all.maxZ - cz },
    buildingX: (b.minX + b.maxX) / 2 - cx,
    dispose: () => {
      mats.dispose();
      mats.extra.forEach((m) => m.dispose());
    },
  };
}

type Tools = {
  box: (parent: THREE.Object3D, color: string, size: V3, at: V3, o?: { cast?: boolean; receive?: boolean; emissive?: number; rotY?: number }) => THREE.Mesh;
  cyl: (parent: THREE.Object3D, color: string, r: number, h: number, at: V3, o?: { rotX?: number; rotZ?: number }) => THREE.Mesh;
  mat: (color: string, opts?: { emissive?: number }) => THREE.Material;
};
type Area = { x: number; z: number; w: number; d: number; y: number };

/** Mobilier de chaque pièce. En pièce grisée, tout est neutre et aucune couleur de statut n'apparaît. */
function decorate(zone: ZoneConfig, g: THREE.Group, a: Area, dim: boolean, f: SceneFacts, pal: Palette, tools: Tools) {
  const { box, cyl, mat } = tools;
  const furn = dim ? pal.partition : pal.furniture;
  const dark = dim ? pal.partition : pal.furnitureDark;
  const light = dim ? pal.soon : pal.dark ? "#cbd5e1" : "#ffffff";
  switch (zone.decor) {
    case "racks": {
      // rayonnages : les cartons rouges représentent les articles sous le stock minimum
      const len = a.w - 1.6;
      const slots: THREE.Mesh[] = [];
      for (let r = 0; r < 3; r++) {
        const z = a.z + 0.8 + r * 1.35;
        for (const dx of [0, len]) for (const dz of [-0.3, 0.3]) box(g, dark, [0.08, 2.2, 0.08], [a.x + 0.8 + dx, a.y, z + dz]);
        for (let s = 0; s < 3; s++) {
          const y = a.y + 0.25 + s * 0.7;
          box(g, furn, [len, 0.05, 0.66], [a.x + 0.8 + len / 2, y, z]);
          for (let i = 0; i < Math.floor(len / 0.75); i++) {
            if ((i + s + r) % 4 === 3) continue; // quelques emplacements vides
            slots.push(box(g, dim ? pal.partition : pal.box, [0.55, 0.42, 0.5], [a.x + 1.15 + i * 0.75, y + 0.05, z]));
          }
        }
      }
      if (!dim && f.lowStock > 0) {
        const red = mat(pal.danger, { emissive: 0.25 });
        const n = Math.min(f.lowStock, slots.length);
        // répartis sur les rayons, de façon stable
        for (let i = 0; i < n; i++) slots[Math.floor((i * slots.length) / n + 1) % slots.length].material = red;
      }
      // palette devant les rayons
      box(g, dark, [1.0, 0.12, 0.8], [a.x + a.w - 1.2, a.y, a.z + a.d - 0.7]);
      box(g, dim ? pal.partition : pal.box, [0.8, 0.5, 0.6], [a.x + a.w - 1.2, a.y + 0.12, a.z + a.d - 0.7]);
      break;
    }
    case "desks": {
      // postes de travail : écrans allumés (couleur de marque) et armoires de classement
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 2; c++) {
          const x = a.x + 1.4 + c * 2.6;
          const z = a.z + 1.5 + r * 1.9;
          box(g, light, [1.5, 0.06, 0.75], [x, a.y + 0.72, z]);
          box(g, furn, [0.06, 0.72, 0.7], [x - 0.7, a.y, z]);
          box(g, furn, [0.06, 0.72, 0.7], [x + 0.7, a.y, z]);
          box(g, dark, [0.62, 0.4, 0.04], [x, a.y + 0.86, z - 0.22]);
          box(g, dim ? pal.partition : pal.brand, [0.56, 0.32, 0.01], [x, a.y + 0.9, z - 0.195], { emissive: dim ? 0 : pal.dark ? 0.55 : 0.2, cast: false });
          box(g, dark, [0.5, 0.45, 0.5], [x, a.y, z + 0.6]);
          box(g, dark, [0.5, 0.5, 0.08], [x, a.y + 0.45, z + 0.84]);
        }
      for (let i = 0; i < 4; i++) box(g, furn, [0.8, 1.4, 0.5], [a.x + a.w - 1.0 - i * 0.85, a.y, a.z + 0.35]);
      break;
    }
    case "lockers": {
      // vestiaires, banc, borne de pointage (verte quand quelqu'un a pointé) et silhouettes des présents
      for (let i = 0; i < 7; i++) {
        box(g, i % 2 ? furn : dark, [0.5, 1.9, 0.6], [a.x + 0.35, a.y, a.z + 0.6 + i * 0.58]);
        box(g, light, [0.02, 0.12, 0.04], [a.x + 0.66, a.y + 1.1, a.z + 0.75 + i * 0.58], { cast: false });
      }
      box(g, light, [0.45, 0.08, 2.6], [a.x + 1.6, a.y + 0.42, a.z + 2.4]);
      box(g, dark, [0.3, 0.42, 0.3], [a.x + 1.6, a.y, a.z + 1.4]);
      box(g, dark, [0.3, 0.42, 0.3], [a.x + 1.6, a.y, a.z + 3.4]);
      // borne de pointage contre le mur du fond
      box(g, dark, [0.5, 1.3, 0.3], [a.x + a.w - 1.2, a.y, a.z + 0.3]);
      box(g, dim ? pal.partition : f.workersIn ? pal.ok : pal.furniture, [0.34, 0.24, 0.02], [a.x + a.w - 1.2, a.y + 1.0, a.z + 0.46], { emissive: !dim && f.workersIn ? 0.6 : 0, cast: false });
      const n = dim ? 0 : Math.min(f.workersIn, 6);
      for (let i = 0; i < n; i++) person(g, pal.person, a.x + 2.6 + (i % 3) * 1.1, a.y, a.z + 1.4 + Math.floor(i / 3) * 1.5, tools);
      break;
    }
    case "board": {
      // tableau de planning : barres de Gantt (rouges = chantiers en retard), table de réunion
      const bx = a.x + a.w / 2;
      const bz = a.z + 0.5;
      box(g, dark, [0.08, 2.1, 0.08], [bx - 1.7, a.y, bz]);
      box(g, dark, [0.08, 2.1, 0.08], [bx + 1.7, a.y, bz]);
      box(g, light, [3.4, 1.5, 0.06], [bx, a.y + 0.55, bz]);
      const late = dim ? 0 : Math.min(f.lateJobs, 6);
      for (let i = 0; i < 6; i++) {
        const len = 0.8 + ((i * 7) % 5) * 0.32;
        const start = ((i * 5) % 4) * 0.35;
        box(g, dim ? pal.partition : i < late ? pal.danger : pal.brand, [len, 0.13, 0.02], [bx - 1.5 + start + len / 2, a.y + 0.72 + i * 0.21, bz + 0.04], { cast: false });
      }
      if (!dim && f.weatherToday) box(g, pal.warning, [3.4, 0.1, 0.03], [bx, a.y + 2.05, bz + 0.04], { cast: false });
      // table et chaises
      box(g, light, [2.6, 0.08, 1.2], [bx, a.y + 0.72, a.z + 2.9]);
      box(g, dark, [0.12, 0.72, 0.12], [bx - 1.1, a.y, a.z + 2.9]);
      box(g, dark, [0.12, 0.72, 0.12], [bx + 1.1, a.y, a.z + 2.9]);
      for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.95, 0.95]) box(g, furn, [0.45, 0.45, 0.45], [bx + dx, a.y, a.z + 2.9 + dz]);
      break;
    }
    case "parking": {
      // parking : une camionnette par chantier en cours (8 au maximum, le reste en « +N »)
      box(g, pal.asphalt, [a.w, 0.04, a.d], [a.x + a.w / 2, 0, a.z + a.d / 2], { cast: false });
      const cols = 4;
      const slotW = a.w / cols;
      for (let r = 0; r < 2; r++) {
        const z0 = r === 0 ? a.z + 0.3 : a.z + a.d - 3.0;
        for (let i = 0; i <= cols; i++) box(g, pal.marking, [0.06, 0.01, 2.6], [a.x + i * slotW, 0.04, z0 + 1.3], { cast: false });
      }
      const vans = dim ? 0 : Math.min(f.vans, MAX_VANS);
      for (let i = 0; i < vans; i++) {
        const r = Math.floor(i / cols);
        const x = a.x + slotW * (i % cols) + slotW / 2;
        const z = r === 0 ? a.z + 1.6 : a.z + a.d - 1.7;
        van(g, x, z, r === 0 ? 0 : Math.PI, pal, tools);
      }
      break;
    }
    case "empty":
      break;
  }
}

/** Silhouette simple d'ouvrier (corps + tête). */
function person(g: THREE.Group, color: string, x: number, y: number, z: number, { box, cyl }: Tools) {
  cyl(g, color, 0.2, 0.9, [x, y + 0.45, z]);
  cyl(g, color, 0.14, 0.26, [x, y + 1.05, z]); // tête
  box(g, color, [0.36, 0.08, 0.36], [x, y + 1.2, z]); // casque
}

/** Camionnette low-poly : caisse, cabine, vitres, roues, bande de couleur de marque. */
function van(g: THREE.Group, x: number, z: number, rot: number, pal: Palette, { box, cyl }: Tools) {
  const v = new THREE.Group();
  v.position.set(x, 0, z);
  v.rotation.y = rot;
  g.add(v);
  box(v, pal.van, [1.0, 1.0, 1.5], [0, 0.25, -0.25]);
  box(v, pal.van, [1.0, 0.7, 0.75], [0, 0.25, 0.85]);
  box(v, pal.glass, [0.92, 0.32, 0.02], [0, 0.6, 1.23], { cast: false });
  box(v, pal.brand, [1.02, 0.12, 1.4], [0, 0.6, -0.25], { cast: false });
  for (const wx of [-0.5, 0.5]) for (const wz of [-0.6, 0.8]) cyl(v, "#1f2937", 0.2, 0.12, [wx, 0.2, wz], { rotZ: Math.PI / 2 });
}
