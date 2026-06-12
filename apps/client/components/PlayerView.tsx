'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { PLAYER_COLORS, MAX_HP, getWeapon } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import type { PredState } from '@/components/Scene';

const SWING_MS = 220;
const FLASH_MS = 180;

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
  const weaponMesh = useRef<Mesh>(null);
  const bodyMat = useRef<MeshStandardMaterial>(null);
  const shield = useRef<Mesh>(null);

  const prevAttackAt = useRef(0);
  const prevHitAt = useRef(0);
  const swingStart = useRef(-1);
  const flashStart = useRef(-1);
  const facingSmooth = useRef(0);

  const color = PLAYER_COLORS[room.state.players.get(id)?.colorIndex ?? 0] ?? '#3b82f6';
  const flashColor = useRef(new Color('#ffffff'));
  const baseColor = useRef(new Color(color));

  useFrame((state) => {
    const p = room.state.players.get(id);
    const g = group.current;
    if (!g) return;

    if (!p || !p.alive) {
      g.visible = false;
      return;
    }
    g.visible = true;

    const nowMs = state.clock.elapsedTime * 1000;

    // Position: predicted for the local player, interpolated for everyone else.
    if (local && pred.initialized) {
      g.position.set(pred.body.x, pred.body.y, pred.body.z);
    } else {
      g.position.x += (p.x - g.position.x) * 0.3;
      g.position.y += (p.y - g.position.y) * 0.3;
      g.position.z += (p.z - g.position.z) * 0.3;
    }

    // Facing (smoothly rotate to face +X or -X).
    const facing = local && pred.initialized ? pred.body.facing : p.facing;
    const targetRot = facing >= 0 ? 0 : Math.PI;
    facingSmooth.current += shortestAngle(facingSmooth.current, targetRot) * 0.3;
    g.rotation.y = facingSmooth.current;

    // Attack swing trigger.
    if (p.lastAttackAt !== prevAttackAt.current) {
      prevAttackAt.current = p.lastAttackAt;
      swingStart.current = nowMs;
    }
    // Hit flash trigger.
    if (p.lastHitAt !== prevHitAt.current) {
      prevHitAt.current = p.lastHitAt;
      flashStart.current = nowMs;
    }

    // Animate the weapon arm.
    if (weaponArm.current) {
      const t = swingStart.current >= 0 ? (nowMs - swingStart.current) / SWING_MS : 2;
      let z = -0.25; // resting
      if (t < 1) {
        // Quick forward chop then ease back.
        const swing = Math.sin(Math.min(1, t) * Math.PI);
        z = -0.25 - swing * 1.35;
      }
      weaponArm.current.rotation.z = z;
    }

    // Weapon appearance from current weapon config.
    if (weaponMesh.current) {
      const weapon = getWeapon(p.weapon);
      const mat = weaponMesh.current.material as MeshStandardMaterial;
      mat.color.set(weapon.color);
      const len = weapon.range * 0.45;
      weaponMesh.current.scale.set(len / 1.0, 1, 1);
      weaponMesh.current.position.x = len / 2;
    }

    // Hit flash on the body material.
    if (bodyMat.current) {
      const ft = flashStart.current >= 0 ? (nowMs - flashStart.current) / FLASH_MS : 2;
      if (ft < 1) {
        bodyMat.current.color.copy(baseColor.current).lerp(flashColor.current, 1 - ft);
      } else {
        bodyMat.current.color.copy(baseColor.current);
      }
    }

    // Block shield.
    if (shield.current) {
      shield.current.visible = p.blocking;
    }
  });

  const weapon = getWeapon(room.state.players.get(id)?.weapon ?? 'sword');

  return (
    <group ref={group}>
      {/* Body */}
      <mesh castShadow position={[0, 0, 0]}>
        <capsuleGeometry args={[0.34, 0.6, 6, 12]} />
        <meshStandardMaterial ref={bodyMat} color={color} roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Eyes hint (front +X) */}
      <mesh position={[0.22, 0.82, 0.12]}>
        <boxGeometry args={[0.05, 0.08, 0.08]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.22, 0.82, -0.12]}>
        <boxGeometry args={[0.05, 0.08, 0.08]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Legs */}
      <mesh castShadow position={[0.16, -0.7, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh castShadow position={[-0.16, -0.7, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Back arm */}
      <mesh castShadow position={[-0.46, 0.05, 0]}>
        <boxGeometry args={[0.16, 0.55, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* Weapon arm (pivots at shoulder) */}
      <group ref={weaponArm} position={[0.46, 0.32, 0]}>
        <mesh castShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[0.16, 0.55, 0.16]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        {/* Weapon held at the hand, extending forward (+X) */}
        <mesh ref={weaponMesh} position={[0.22, -0.5, 0]}>
          <boxGeometry args={[1.0, 0.12, 0.12]} />
          <meshStandardMaterial color={weapon.color} metalness={0.4} roughness={0.4} />
        </mesh>
      </group>

      {/* Block shield (front) */}
      <mesh ref={shield} position={[0.75, 0, 0]} visible={false}>
        <boxGeometry args={[0.1, 1.1, 0.9]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.4} emissive="#0ea5e9" emissiveIntensity={0.5} />
      </mesh>

      {/* Name + floating health bar */}
      <Html position={[0, 1.5, 0]} center distanceFactor={12} pointerEvents="none">
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
      <div
        style={{
          height: 6,
          width: 70,
          margin: '0 auto',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
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

function shortestAngle(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
