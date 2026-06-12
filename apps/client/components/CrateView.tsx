'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CRATE_SIZE, getWeapon } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';

export function CrateView({ room, id }: { room: ArenaRoom; id: string }) {
  const group = useRef<Group>(null);

  useFrame((state) => {
    const crate = room.state.crates.get(id);
    const g = group.current;
    if (!g) return;
    if (!crate) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(crate.x, crate.y + Math.sin(state.clock.elapsedTime * 2) * 0.12, crate.z);
    g.rotation.y += 0.02;
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[CRATE_SIZE, CRATE_SIZE, CRATE_SIZE]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.6} emissive="#b45309" emissiveIntensity={0.3} />
      </mesh>
      {/* A small floating indicator of the weapon inside. */}
      <mesh position={[0, CRATE_SIZE * 0.85, 0]}>
        <octahedronGeometry args={[0.18]} />
        <meshStandardMaterial
          color={getWeapon(room.state.crates.get(id)?.weapon ?? 'sword').color}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}
