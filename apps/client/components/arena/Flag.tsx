'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, DoubleSide, Mesh, PlaneGeometry } from 'three';

/** A single waving cloth flag on a pole. The plane's vertices ripple each frame. */
export function Flag({
  position,
  color,
  poleHeight = 4,
  seed = 0,
}: {
  position: [number, number, number];
  color: string;
  poleHeight?: number;
  seed?: number;
}) {
  const cloth = useRef<Mesh>(null);
  const geo = useMemo(() => new PlaneGeometry(1.6, 1.0, 10, 6), []);
  const base = useMemo(() => geo.attributes.position.array.slice(), [geo]);

  useFrame((state) => {
    if (!cloth.current) return;
    const t = state.clock.elapsedTime;
    const pos = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const wave = Math.sin(x * 3 - t * 6 + seed) * 0.12 * (x + 0.8);
      pos.setZ(i, wave);
      pos.setX(i, x);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, poleHeight, 6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} metalness={0.3} />
      </mesh>
      {/* Finial */}
      <mesh position={[0, poleHeight + 0.1, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Cloth */}
      <mesh ref={cloth} geometry={geo} position={[0.85, poleHeight - 0.7, 0]}>
        <meshStandardMaterial color={color} side={DoubleSide} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}
