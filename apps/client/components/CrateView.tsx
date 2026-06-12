'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { getWeapon, RARITY_COLOR } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import { WeaponModel } from '@/components/WeaponModel';

/**
 * A recognizable weapon pickup: the actual low-poly weapon model floating and
 * slowly turning above a small stone pedestal, ringed in its rarity color.
 */
export function CrateView({ room, id }: { room: ArenaRoom; id: string }) {
  const group = useRef<Group>(null);
  const spin = useRef<Group>(null);

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
    if (spin.current) spin.current.rotation.y += 0.025;
  });

  const crate = room.state.crates.get(id);
  const weapon = getWeapon(crate?.weapon ?? 'sword');
  const rarity = RARITY_COLOR[weapon.rarity];
  const isBarrel = weapon.category === 'thrown' || weapon.category === 'placed';

  return (
    <group ref={group}>
      {/* Stone pedestal */}
      <mesh position={[0, -0.7, 0]} receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.3, 8]} />
        <meshStandardMaterial color="#8b8170" roughness={1} flatShading />
      </mesh>
      {/* Rarity ring */}
      <mesh position={[0, -0.53, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.66, 20]} />
        <meshBasicMaterial color={rarity} transparent opacity={0.85} />
      </mesh>
      {/* Rarity glow column */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 2, 12, 1, true]} />
        <meshBasicMaterial color={rarity} transparent opacity={0.12} side={2} />
      </mesh>

      {/* The pickup itself */}
      <group ref={spin} position={[0, 0.05, 0]}>
        {isBarrel ? (
          <group>
            <mesh castShadow>
              <cylinderGeometry args={[0.34, 0.34, 0.7, 10]} />
              <meshStandardMaterial color="#6b4f33" roughness={0.8} flatShading />
            </mesh>
            <group position={[0, 0.5, 0]} scale={1.1}>
              <WeaponModel weapon={weapon.id} />
            </group>
          </group>
        ) : (
          <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={1.15}>
            <WeaponModel weapon={weapon.id} />
          </group>
        )}
      </group>
    </group>
  );
}
