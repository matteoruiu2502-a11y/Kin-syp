// Ambiance légère et désactivable : nuages qui dérivent et fumée discrète de la cheminée.
// Ces objets ne projettent pas d'ombre : la carte d'ombres du bâtiment reste calculée une seule fois.

import * as THREE from "three";
import { SHARED } from "./scene";
import type { Palette } from "./theme";

export type Ambiance = { group: THREE.Group; update: (dt: number) => void; dispose: () => void };

export function createAmbiance(pal: Palette, chimney: THREE.Vector3, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): Ambiance {
  const group = new THREE.Group();
  const owned: THREE.Material[] = [];

  // nuages : grappes de sphères basse définition
  const cloudMat = new THREE.MeshLambertMaterial({ color: pal.cloud, transparent: true, opacity: pal.dark ? 0.55 : 0.9, flatShading: true });
  owned.push(cloudMat);
  const minX = bounds.minX - 12;
  const maxX = bounds.maxX + 12;
  const clouds = [0, 1, 2].map((i) => {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(SHARED.sphere, cloudMat);
      const s = 1.4 + ((i + k) % 3) * 0.5;
      m.scale.set(s * 1.4, s, s);
      m.position.set(k * 1.1 - 1.6, (k % 2) * 0.35, ((k * 7) % 3) * 0.4);
      c.add(m);
    }
    c.position.set(minX + ((maxX - minX) * (i + 0.3)) / 3, 10 + i * 1.3, bounds.minZ - 3 + i * 4);
    group.add(c);
    return { c, speed: 0.35 + i * 0.12 };
  });

  // fumée : quelques bouffées qui montent, grossissent et s'effacent
  const puffs = Array.from({ length: 6 }, (_, i) => {
    const mat = new THREE.MeshLambertMaterial({ color: pal.dark ? "#475569" : "#e2e8f0", transparent: true, opacity: 0, depthWrite: false });
    owned.push(mat);
    const m = new THREE.Mesh(SHARED.sphere, mat);
    group.add(m);
    return { m, mat, phase: i / 6 };
  });

  let time = 0;
  const update = (dt: number) => {
    time += dt;
    for (const { c, speed } of clouds) {
      c.position.x += speed * dt;
      if (c.position.x > maxX) c.position.x = minX;
    }
    for (const p of puffs) {
      const t = (time / 4 + p.phase) % 1; // cycle de 4 s
      p.m.position.set(chimney.x + t * 0.8, chimney.y + t * 2.6, chimney.z + t * 0.3);
      const s = 0.35 + t * 0.9;
      p.m.scale.set(s, s, s);
      p.mat.opacity = (pal.dark ? 0.35 : 0.6) * Math.sin(Math.PI * t);
    }
  };
  update(0);

  return { group, update, dispose: () => owned.forEach((m) => m.dispose()) };
}
