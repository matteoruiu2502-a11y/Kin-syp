"use client";

// Scène 3D du hero : un immeuble qui « se construit » étage par étage.
// Chaque élément apparaît d'abord en fil de fer (arêtes lumineuses), puis se remplit
// (wireframe → solide). Un anneau de scan suit le chantier, des particules montent,
// une grue tourne, et l'ensemble réagit doucement à la souris (parallaxe 3D).

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type PieceKind = "column" | "slab" | "glass" | "block";
type Piece = {
  kind: PieceKind;
  position: [number, number, number];
  size: [number, number, number];
  delay: number;
};

const FLOOR_H = 0.52;
const FLOOR_STEP = 0.62; // secondes entre deux étages
const CYCLE = 17; // durée d'un cycle construction → pause → dissolution
const DISSOLVE = 1.6;

/** Génère la maquette (déterministe) : tour principale, retrait en attique, annexe basse. */
function buildPieces(): Piece[] {
  const pieces: Piece[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const volumes = [
    { floors: [0, 4], w: 3.2, d: 2.2, cols: [4, 3], x: -0.4, z: 0 },
    { floors: [4, 7], w: 2.1, d: 1.5, cols: [3, 2], x: -0.9, z: -0.2 },
    { floors: [0, 2], w: 1.5, d: 1.6, cols: [2, 2], x: 2.05, z: 0.2, late: 0.3 },
  ];

  for (const v of volumes) {
    for (let f = v.floors[0]; f < v.floors[1]; f++) {
      const base = f * FLOOR_STEP + (v.late ?? 0);
      const y0 = f * FLOOR_H;
      const [nx, nz] = v.cols;
      const xs = Array.from({ length: nx }, (_, i) => v.x - v.w / 2 + (v.w * i) / (nx - 1));
      const zs = Array.from({ length: nz }, (_, i) => v.z - v.d / 2 + (v.d * i) / (nz - 1));

      // Poteaux
      let i = 0;
      for (const x of xs)
        for (const z of zs)
          pieces.push({ kind: "column", position: [x, y0 + FLOOR_H / 2, z], size: [0.07, FLOOR_H, 0.07], delay: base + i++ * 0.025 });

      // Dalle
      pieces.push({ kind: "slab", position: [v.x, y0 + FLOOR_H, v.z], size: [v.w + 0.14, 0.06, v.d + 0.14], delay: base + 0.32 });

      // Façades vitrées / pleines, travée par travée
      for (let b = 0; b < nx - 1; b++) {
        const cx = (xs[b] + xs[b + 1]) / 2;
        const bw = xs[b + 1] - xs[b] - 0.08;
        for (const z of [zs[0], zs[nz - 1]]) {
          if (rand() < 0.18) continue;
          const kind: PieceKind = rand() < 0.72 ? "glass" : "block";
          pieces.push({ kind, position: [cx, y0 + FLOOR_H / 2, z], size: [bw, FLOOR_H - 0.08, 0.025], delay: base + 0.45 + rand() * 0.25 });
        }
      }
      for (let b = 0; b < nz - 1; b++) {
        const cz = (zs[b] + zs[b + 1]) / 2;
        const bd = zs[b + 1] - zs[b] - 0.08;
        for (const x of [xs[0], xs[nx - 1]]) {
          if (rand() < 0.25) continue;
          const kind: PieceKind = rand() < 0.65 ? "glass" : "block";
          pieces.push({ kind, position: [x, y0 + FLOOR_H / 2, cz], size: [0.025, FLOOR_H - 0.08, bd], delay: base + 0.5 + rand() * 0.25 });
        }
      }
    }
  }
  return pieces;
}

const STYLE: Record<PieceKind, { fill: string; emissive: string; emissiveIntensity: number; opacity: number; edge: string }> = {
  column: { fill: "#0f1d33", emissive: "#0b2a5c", emissiveIntensity: 0.4, opacity: 1, edge: "#38bdf8" },
  slab: { fill: "#0d1a2e", emissive: "#0a2350", emissiveIntensity: 0.35, opacity: 1, edge: "#22d3ee" },
  glass: { fill: "#0a3a7a", emissive: "#0066ff", emissiveIntensity: 0.55, opacity: 0.42, edge: "#60a5fa" },
  block: { fill: "#0c2a26", emissive: "#10b981", emissiveIntensity: 0.28, opacity: 0.9, edge: "#34d399" },
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

type PieceRefs = { group: THREE.Group; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; line: THREE.LineSegments; lineMat: THREE.LineBasicMaterial };

function Building({ reduced }: { reduced: boolean }) {
  const pieces = useMemo(buildPieces, []);
  const refs = useRef<(PieceRefs | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);
  const tmp = useMemo(() => ({ bright: new THREE.Color("#e0f2fe"), c: new THREE.Color() }), []);
  const lastDelay = useMemo(() => Math.max(...pieces.map((p) => p.delay)), [pieces]);

  useEffect(() => () => {
    boxGeo.dispose();
    edgeGeo.dispose();
  }, [boxGeo, edgeGeo]);

  useFrame(({ clock }) => {
    const t = reduced ? 99 : clock.elapsedTime % CYCLE;
    const fade = reduced ? 1 : clamp01((CYCLE - t) / DISSOLVE);

    pieces.forEach((p, i) => {
      const r = refs.current[i];
      if (!r) return;
      const s = STYLE[p.kind];
      const appear = clamp01((t - p.delay) / 0.5);
      const solid = clamp01((t - p.delay - 0.55) / 0.9);
      const e = easeOut(appear);

      r.group.visible = appear > 0.001;
      // Chute douce + croissance verticale des poteaux
      r.group.position.set(p.position[0], p.position[1] + (1 - e) * 0.9, p.position[2]);
      const grow = p.kind === "column" ? Math.max(e, 0.001) : 1;
      r.group.scale.set(p.size[0], p.size[1] * grow, p.size[2]);

      r.mat.opacity = solid * s.opacity * fade;
      r.mat.visible = r.mat.opacity > 0.01;
      // Les arêtes flashent en blanc à l'apparition puis prennent leur teinte
      tmp.c.set(s.edge).lerp(tmp.bright, 1 - solid);
      r.lineMat.color.copy(tmp.c);
      r.lineMat.opacity = (0.35 + 0.65 * (1 - solid * 0.55)) * e * fade;
    });

    // Anneau de scan : suit l'étage en cours puis disparaît quand la tour est finie
    if (ring.current && ringMat.current) {
      const progress = clamp01(t / (lastDelay + 0.6));
      ring.current.position.y = 0.02 + progress * (7 * FLOOR_H + 0.1);
      const pulse = 1 + Math.sin(t * 6) * 0.03;
      ring.current.scale.set(pulse, pulse, pulse);
      ringMat.current.opacity = (progress < 1 ? 0.55 : Math.max(0, 0.55 - (t - lastDelay - 0.6) * 0.6)) * fade;
    }
  });

  return (
    <group>
      {pieces.map((p, i) => {
        const s = STYLE[p.kind];
        return (
          <group
            key={i}
            visible={false}
            ref={(g) => {
              if (!g) return void (refs.current[i] = null);
              const mesh = g.children[0] as THREE.Mesh;
              const line = g.children[1] as THREE.LineSegments;
              refs.current[i] = { group: g, mesh, mat: mesh.material as THREE.MeshStandardMaterial, line, lineMat: line.material as THREE.LineBasicMaterial };
            }}
          >
            <mesh geometry={boxGeo}>
              <meshStandardMaterial color={s.fill} emissive={s.emissive} emissiveIntensity={s.emissiveIntensity} roughness={0.35} metalness={0.4} transparent opacity={0} depthWrite={p.kind !== "glass"} />
            </mesh>
            <lineSegments geometry={edgeGeo}>
              <lineBasicMaterial color={s.edge} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </lineSegments>
          </group>
        );
      })}

      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0.3, 0, 0.05]}>
        <ringGeometry args={[2.35, 2.42, 96]} />
        <meshBasicMaterial ref={ringMat} color="#10b981" transparent opacity={0} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Grue à tour en fil de fer, flèche en rotation lente. */
function Crane({ reduced }: { reduced: boolean }) {
  const jib = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const mastGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.16, 4.6, 0.16, 1, 12, 1)), []);
  const jibGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(3.6, 0.14, 0.14, 14, 1, 1)), []);
  const counterGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 0.22, 0.26)), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (jib.current && !reduced) jib.current.rotation.y = Math.sin(t * 0.18) * 0.9 - 0.4;
    if (hook.current && !reduced) hook.current.position.y = -0.9 - Math.sin(t * 0.7) * 0.5;
  });

  return (
    <group position={[-2.9, 0, -1.6]}>
      <lineSegments geometry={mastGeo} position={[0, 2.3, 0]}>
        <lineBasicMaterial color="#f59e0b" transparent opacity={0.55} />
      </lineSegments>
      <group ref={jib} position={[0, 4.65, 0]}>
        <lineSegments geometry={jibGeo} position={[1.1, 0, 0]}>
          <lineBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </lineSegments>
        <lineSegments geometry={counterGeo} position={[-0.6, -0.1, 0]}>
          <lineBasicMaterial color="#fbbf24" transparent opacity={0.5} />
        </lineSegments>
        <group position={[2.5, 0, 0]}>
          <group ref={hook} position={[0, -0.9, 0]}>
            <mesh>
              <boxGeometry args={[0.1, 0.1, 0.1]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Particules lumineuses qui s'élèvent du chantier. */
function Sparks({ count = 520, reduced }: { count?: number; reduced: boolean }) {
  const points = useRef<THREE.Points>(null);
  const { positions, colors, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const blue = new THREE.Color("#3b82ff");
    const green = new THREE.Color("#10b981");
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 1.2 + Math.random() * 3.6;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = Math.sin(a) * r;
      c.copy(blue).lerp(green, Math.random());
      colors.set([c.r, c.g, c.b], i * 3);
      speeds[i] = 0.15 + Math.random() * 0.45;
    }
    return { positions, colors, speeds };
  }, [count]);

  useFrame((_, dt) => {
    if (!points.current || reduced) return;
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * dt;
      if (arr[i * 3 + 1] > 5.2) arr[i * 3 + 1] = 0;
    }
    attr.needsUpdate = true;
    points.current.rotation.y += dt * 0.03;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} vertexColors transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Ground() {
  return (
    <group>
      <gridHelper args={[24, 48, "#0b4bd1", "#0c1a33"]} position={[0, 0, 0]} />
      <mesh rotation-x={-Math.PI / 2} position={[0.3, 0.005, 0]}>
        <circleGeometry args={[3.4, 64]} />
        <meshBasicMaterial color="#0066ff" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0.3, 0.006, 0]}>
        <ringGeometry args={[3.35, 3.4, 96]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Parallaxe : la maquette pivote vers la souris, avec une lente rotation automatique. */
function Rig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const { camera, size } = useThree();

  useFrame(({ pointer }, dt) => {
    // Écrans étroits : on rapproche la caméra pour garder la maquette lisible
    const zoom = size.width / size.height < 1.2 ? 0.82 : 1;
    if (!group.current) return;
    if (!reduced) spin.current += dt * 0.07;
    const targetY = -0.5 + Math.sin(spin.current) * 0.35 + pointer.x * 0.45;
    const targetX = pointer.y * 0.08;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.05);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.05);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, (8.4 + pointer.x * 0.8) * zoom, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, (5.4 + pointer.y * 0.5) * zoom, 0.04);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 9.8 * zoom, 0.04);
    camera.lookAt(0.2, 2.1, 0);
  });

  return <group ref={group}>{children}</group>;
}

export default function HeroScene() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    if (wrapper.current) io.observe(wrapper.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapper} className="h-full w-full">
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 1.8]}
        camera={{ position: [8.4, 5.4, 9.8], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        eventSource={typeof document !== "undefined" ? document.body : undefined}
        eventPrefix="client"
      >
        <fog attach="fog" args={["#03060d", 9, 20]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 6, 4]} intensity={40} color="#3b82ff" />
        <pointLight position={[-4, 3, -2]} intensity={25} color="#10b981" />
        <directionalLight position={[2, 8, 5]} intensity={0.6} />
        <Rig reduced={reduced}>
          <Building reduced={reduced} />
          <Crane reduced={reduced} />
          <Sparks reduced={reduced} />
          <Ground />
        </Rig>
      </Canvas>
    </div>
  );
}
