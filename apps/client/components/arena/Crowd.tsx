'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { ARENA_RADIUS } from '@arena/shared';

// Stands sit behind the pit (rear quadrants) so their end-caps never face the
// side-view camera and the foreground/sides stay open. three's CylinderGeometry
// uses theta=0 at +Z, so [120°, 240°] is centered on the far back (-Z).
const THETA_START = (Math.PI * 2) / 3; // 120°
const THETA_LENGTH = (Math.PI * 2) / 3; // 120° (rear arc, centered on -Z)

const ROWS = 6;
const PER_ROW = 54;
const COUNT = ROWS * PER_ROW;

const CLOTH_COLORS = [
  '#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7e22ce',
  '#0f766e', '#c2410c', '#4338ca', '#9d174d', '#374151',
];
const SKIN_COLORS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

interface Seat {
  x: number;
  y: number;
  z: number;
  phase: number;
  scale: number;
}

export function Crowd({ cheerRef }: { cheerRef: React.MutableRefObject<number> }) {
  const bodies = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const seats = useMemo<Seat[]>(() => {
    const out: Seat[] = [];
    for (let row = 0; row < ROWS; row++) {
      const f = row / (ROWS - 1);
      const radius = lerp(ARENA_RADIUS + 2.2, ARENA_RADIUS + 8.2, f);
      const y = lerp(0.6, 4.4, f);
      for (let i = 0; i < PER_ROW; i++) {
        // Stagger alternate rows so the crowd reads as a packed bank.
        const t = (i + (row % 2) * 0.5) / PER_ROW;
        const theta = THETA_START + t * THETA_LENGTH;
        out.push({
          x: radius * Math.sin(theta),
          y,
          z: radius * Math.cos(theta),
          phase: Math.random() * Math.PI * 2,
          scale: 0.85 + Math.random() * 0.3,
        });
      }
    }
    return out;
  }, []);

  // Assign per-instance colors once.
  useEffect(() => {
    const bodyColor = new Color();
    const headColor = new Color();
    seats.forEach((_, i) => {
      bodyColor.set(CLOTH_COLORS[i % CLOTH_COLORS.length]);
      headColor.set(SKIN_COLORS[i % SKIN_COLORS.length]);
      bodies.current?.setColorAt(i, bodyColor);
      heads.current?.setColorAt(i, headColor);
    });
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true;
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [seats]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cheer = cheerRef.current;
    const amp = 0.05 + cheer * 0.22;
    const speed = 4 + cheer * 5;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      const bob = Math.sin(t * speed + s.phase) * amp;
      // Body
      dummy.position.set(s.x, s.y + bob, s.z);
      dummy.scale.set(s.scale, s.scale, s.scale);
      dummy.rotation.set(0, Math.atan2(-s.x, -s.z), 0);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);
      // Head sits above the body
      dummy.position.set(s.x, s.y + bob + 0.5 * s.scale, s.z);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      heads.current?.setMatrixAt(i, dummy.matrix);
    }
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Sloped seating bank (stone/wood) behind the wall. */}
      <mesh position={[0, 2.5, 0]} receiveShadow={false}>
        <cylinderGeometry
          args={[ARENA_RADIUS + 9, ARENA_RADIUS + 1.5, 5, 40, 1, true, THETA_START, THETA_LENGTH]}
        />
        <meshStandardMaterial color="#6b5b43" roughness={1} side={2} flatShading />
      </mesh>
      {/* A stone lip at the base of the stands. */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry
          args={[ARENA_RADIUS + 1.6, ARENA_RADIUS + 1.4, 0.6, 40, 1, true, THETA_START, THETA_LENGTH]}
        />
        <meshStandardMaterial color="#8b8170" roughness={1} side={2} flatShading />
      </mesh>

      {/* Instanced crowd — bodies + heads. */}
      <instancedMesh ref={bodies} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <capsuleGeometry args={[0.16, 0.34, 3, 6]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 6, 5]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
