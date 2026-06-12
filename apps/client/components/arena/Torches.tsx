'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointLight, Mesh } from 'three';
import { ARENA_RADIUS, WALL_HEIGHT } from '@arena/shared';

/** A handful of wall torches with cheap flickering point lights. */
export function Torches() {
  const torches = useMemo(() => {
    // Spread around the back hemisphere only, so flames never sit between the
    // camera (at +Z) and the pit.
    const angles = [110, 145, 180, 215, 250].map((d) => (d * Math.PI) / 180);
    return angles.map((a) => ({
      x: Math.sin(a) * (ARENA_RADIUS + 0.2),
      z: Math.cos(a) * (ARENA_RADIUS + 0.2),
      seed: Math.random() * 10,
    }));
  }, []);

  return (
    <group>
      {torches.map((t, i) => (
        <Torch key={i} x={t.x} z={t.z} seed={t.seed} />
      ))}
    </group>
  );
}

function Torch({ x, z, seed }: { x: number; z: number; seed: number }) {
  const light = useRef<PointLight>(null);
  const flame = useRef<Mesh>(null);
  const topY = WALL_HEIGHT + 0.4;

  useFrame((state) => {
    const f = 0.7 + Math.sin(state.clock.elapsedTime * 12 + seed) * 0.15 +
      Math.sin(state.clock.elapsedTime * 27 + seed * 2) * 0.1;
    if (light.current) light.current.intensity = 6 * f;
    if (flame.current) flame.current.scale.setScalar(0.9 + f * 0.25);
  });

  return (
    <group position={[x, 0, z]}>
      {/* Bracket post */}
      <mesh position={[0, topY - 0.5, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
        <meshStandardMaterial color="#3b2d1f" roughness={1} />
      </mesh>
      {/* Flame */}
      <mesh ref={flame} position={[0, topY + 0.15, 0]}>
        <coneGeometry args={[0.18, 0.5, 7]} />
        <meshBasicMaterial color="#ff7a18" />
      </mesh>
      <pointLight
        ref={light}
        position={[0, topY + 0.3, 0]}
        color="#ff8a3d"
        intensity={6}
        distance={9}
        decay={2}
      />
    </group>
  );
}
