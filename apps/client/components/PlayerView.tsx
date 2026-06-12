'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, type Group, type MeshStandardMaterial } from 'three';
import { PLAYER_COLORS, MAX_HP } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import type { PredState } from '@/components/Scene';
import { WeaponModel } from '@/components/WeaponModel';

const SWING_MS = 320;
const FLASH_MS = 180;

/**
 * Third-person low-poly **gladiator** for remote players (helmet, chest & shoulder
 * armor, belt, boots + held weapon). The local player is hidden — they see the
 * first-person viewmodel instead.
 */
export function PlayerView({
  room,
  id,
  local,
  pred,
}: {
  room: ArenaRoom;
  id: string;
  local: boolean;
  pred: PredState;
}) {
  const group = useRef<Group>(null);
  const weaponArm = useRef<Group>(null);
  const chestMat = useRef<MeshStandardMaterial>(null);

  const prevAttackAt = useRef(0);
  const prevHitAt = useRef(0);
  const swingStart = useRef(-1);
  const swingType = useRef(0);
  const flashStart = useRef(-1);

  const color = PLAYER_COLORS[room.state.players.get(id)?.colorIndex ?? 0] ?? '#3b82f6';
  const base = useRef(new Color(color));
  const flash = useRef(new Color('#ffffff'));

  useFrame((state) => {
    const p = room.state.players.get(id);
    const g = group.current;
    if (!g) return;

    // Hide the local player's own body (first person).
    if (local || !p || !p.alive) {
      g.visible = false;
      return;
    }
    g.visible = true;

    const nowMs = state.clock.elapsedTime * 1000;
    g.position.x += (p.x - g.position.x) * 0.3;
    g.position.y += (p.y - g.position.y) * 0.3;
    g.position.z += (p.z - g.position.z) * 0.3;
    g.rotation.y = -p.yaw;

    if (p.lastAttackAt !== prevAttackAt.current) {
      prevAttackAt.current = p.lastAttackAt;
      swingStart.current = nowMs;
      swingType.current = p.swingType;
    }
    if (p.lastHitAt !== prevHitAt.current) {
      prevHitAt.current = p.lastHitAt;
      flashStart.current = nowMs;
    }

    if (weaponArm.current) {
      const blockPose = p.blocking ? -1.2 : -0.25;
      const t = swingStart.current >= 0 ? (nowMs - swingStart.current) / SWING_MS : 2;
      let rx = blockPose;
      let rz = p.blocking ? 0.5 : 0;
      if (t < 1 && !p.blocking) {
        const e = Math.sin(Math.min(1, t) * Math.PI);
        if (swingType.current === 2) rx = -0.25 - e * 1.5;
        else rz = (swingType.current === 1 ? -1 : 1) * e * 1.4;
      }
      weaponArm.current.rotation.x = rx;
      weaponArm.current.rotation.z = rz;
    }

    if (chestMat.current) {
      const ft = flashStart.current >= 0 ? (nowMs - flashStart.current) / FLASH_MS : 2;
      if (ft < 1) chestMat.current.color.copy(base.current).lerp(flash.current, 1 - ft);
      else chestMat.current.color.copy(base.current);
    }
  });

  const weaponId = room.state.players.get(id)?.weapon ?? 'sword';

  return (
    <group ref={group}>
      {/* Torso / chest armor */}
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.62, 0.8, 0.42]} />
        <meshStandardMaterial ref={chestMat} color={color} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Chest plate accent */}
      <mesh position={[0, 0.12, 0.22]}>
        <boxGeometry args={[0.44, 0.5, 0.06]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Belt */}
      <mesh position={[0, -0.38, 0]}>
        <boxGeometry args={[0.66, 0.16, 0.46]} />
        <meshStandardMaterial color="#3f2d1c" roughness={0.8} />
      </mesh>

      {/* Helmet + visor */}
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[0.44, 0.44, 0.46]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.74, -0.22]}>
        <boxGeometry args={[0.3, 0.08, 0.05]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[0.1, 0.18, 0.1]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Shoulder pauldrons */}
      <mesh castShadow position={[0.42, 0.36, 0]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} flatShading />
      </mesh>
      <mesh castShadow position={[-0.42, 0.36, 0]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} flatShading />
      </mesh>

      {/* Legs + boots */}
      <mesh castShadow position={[0.17, -0.7, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.24]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-0.17, -0.7, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.24]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      <mesh position={[0.17, -0.98, 0.04]}>
        <boxGeometry args={[0.22, 0.16, 0.34]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>
      <mesh position={[-0.17, -0.98, 0.04]}>
        <boxGeometry args={[0.22, 0.16, 0.34]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>

      {/* Back (shield) arm */}
      <mesh castShadow position={[-0.44, -0.05, 0]}>
        <boxGeometry args={[0.16, 0.6, 0.16]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Weapon arm (pivots at shoulder) */}
      <group ref={weaponArm} position={[0.44, 0.3, 0]}>
        <mesh castShadow position={[0, -0.28, 0]}>
          <boxGeometry args={[0.16, 0.6, 0.16]} />
          <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
        </mesh>
        <group position={[0, -0.55, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <WeaponModel weapon={weaponId} scale={0.85} />
        </group>
      </group>

      <Html position={[0, 1.45, 0]} center distanceFactor={12} pointerEvents="none">
        <NameTag room={room} id={id} />
      </Html>
    </group>
  );
}

function NameTag({ room, id }: { room: ArenaRoom; id: string }) {
  const p = room.state.players.get(id);
  if (!p) return null;
  const pct = Math.max(0, Math.min(1, p.hp / MAX_HP));
  const color = PLAYER_COLORS[p.colorIndex] ?? '#3b82f6';
  return (
    <div style={{ width: 80, textAlign: 'center', transform: 'translateY(-100%)' }}>
      <div
        style={{
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          marginBottom: 2,
          whiteSpace: 'nowrap',
        }}
      >
        {p.name}
      </div>
      <div style={{ height: 6, width: 70, margin: '0 auto', background: 'rgba(0,0,0,0.6)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: pct > 0.4 ? color : '#ef4444',
            transition: 'width 0.12s linear',
          }}
        />
      </div>
    </div>
  );
}
