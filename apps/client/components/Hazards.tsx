'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, PointLight, type MeshStandardMaterial } from 'three';
import type { ArenaRoom } from '@/lib/network';

export function Hazards({ room, ids }: { room: ArenaRoom; ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <HazardView key={id} room={room} id={id} />
      ))}
    </>
  );
}

function HazardView({ room, id }: { room: ArenaRoom; id: string }) {
  const group = useRef<Group>(null);
  const fire = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const blink = useRef<Mesh>(null);

  useFrame((state) => {
    const h = room.state.hazards.get(id);
    const g = group.current;
    if (!g) return;
    if (!h) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(h.x, h.y, h.z);
    const t = state.clock.elapsedTime;
    if (fire.current) {
      const f = 0.8 + Math.sin(t * 14 + h.x) * 0.2;
      fire.current.scale.set(h.radius * 0.9, f, h.radius * 0.9);
    }
    if (light.current) light.current.intensity = 4 + Math.sin(t * 16) * 1.5;
    if (blink.current) {
      const on = Math.sin(t * 8) > 0;
      (blink.current.material as MeshStandardMaterial).emissiveIntensity = on ? 1.2 : 0.1;
    }
  });

  const h = room.state.hazards.get(id);
  const kind = h?.kind ?? 'fire';

  if (kind === 'mine') {
    return (
      <group ref={group}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 0.12, 8]} />
          <meshStandardMaterial color="#374151" flatShading roughness={0.8} />
        </mesh>
        <mesh ref={blink} position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1} />
        </mesh>
      </group>
    );
  }

  // Fire / sprung-spike damage field.
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[(h?.radius ?? 2) * 0.95, 20]} />
        <meshBasicMaterial color={kind === 'spike' ? '#6b7280' : '#ea580c'} transparent opacity={0.35} />
      </mesh>
      {kind === 'spike' ? (
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const r = (h?.radius ?? 1.5) * 0.5;
          return (
            <mesh key={i} position={[Math.cos(a) * r, 0.2, Math.sin(a) * r]}>
              <coneGeometry args={[0.08, 0.4, 5]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.4} />
            </mesh>
          );
        })
      ) : (
        <>
          <mesh ref={fire} position={[0, 0.3, 0]}>
            <coneGeometry args={[1, 1, 7]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.7} />
          </mesh>
          <pointLight ref={light} position={[0, 0.6, 0]} color="#fb923c" intensity={4} distance={8} decay={2} />
        </>
      )}
    </group>
  );
}
