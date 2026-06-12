'use client';

import { PLATFORMS, DEATH_Y } from '@arena/shared';

/** Static low-poly arena: the platforms plus a faint death-boundary plane. */
export function ArenaMesh() {
  return (
    <group>
      {PLATFORMS.map((p, i) => (
        <mesh
          key={i}
          position={[p.cx, p.cy, p.cz]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[p.hx * 2, p.hy * 2, p.hz * 2]} />
          <meshStandardMaterial color={p.color} roughness={0.9} metalness={0.05} />
        </mesh>
      ))}

      {/* Subtle pillars under the main platform for depth. */}
      <mesh position={[0, -6, -0.5]}>
        <boxGeometry args={[1.2, 12, 1.2]} />
        <meshStandardMaterial color="#334155" roughness={1} />
      </mesh>

      {/* Death boundary marker. */}
      <mesh position={[0, DEATH_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 40]} />
        <meshBasicMaterial color="#7f1d1d" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}
