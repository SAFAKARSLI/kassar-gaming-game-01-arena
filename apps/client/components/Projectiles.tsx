'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import type { ArenaRoom } from '@/lib/network';

export function Projectiles({ room, ids }: { room: ArenaRoom; ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <ProjectileView key={id} room={room} id={id} />
      ))}
    </>
  );
}

function ProjectileView({ room, id }: { room: ArenaRoom; id: string }) {
  const group = useRef<Group>(null);
  const look = useRef(new Vector3());

  useFrame(() => {
    const p = room.state.projectiles.get(id);
    const g = group.current;
    if (!g) return;
    if (!p) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(p.x, p.y, p.z);
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    if (speed > 0.5) {
      look.current.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      g.lookAt(look.current); // model points along -Z
    }
    if (p.kind === 'grenade' || p.kind === 'firebomb') g.rotation.z += 0.3;
  });

  const p = room.state.projectiles.get(id);
  const kind = p?.kind ?? 'arrow';

  return (
    <group ref={group}>
      {kind === 'arrow' || kind === 'bolt' ? (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1, 5]} />
            <meshStandardMaterial color="#6b4f33" />
          </mesh>
          <mesh position={[0, 0, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.05, 0.18, 5]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} />
          </mesh>
        </>
      ) : kind === 'knife' ? (
        <mesh>
          <boxGeometry args={[0.05, 0.12, 0.4]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.6} />
        </mesh>
      ) : kind === 'grenade' ? (
        <mesh>
          <icosahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color="#3f6212" flatShading />
        </mesh>
      ) : (
        <mesh>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color="#ea580c" emissive="#7c2d12" emissiveIntensity={0.7} />
        </mesh>
      )}
    </group>
  );
}
