'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { RoundState, getWeapon, PLAYER_COLORS } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import type { InputState } from '@/lib/input';
import type { PredState } from '@/components/Scene';
import { WeaponModel } from '@/components/WeaponModel';

const SWING_MS = 360;

/** Arms + gloves + held weapon, locked to the camera (the local player never sees their own head). */
export function FirstPersonViewmodel({
  room,
  localId,
  inputRef,
  pred,
}: {
  room: ArenaRoom;
  localId: string;
  inputRef: React.MutableRefObject<InputState>;
  pred: PredState;
}) {
  const { camera } = useThree();
  const root = useRef<Group>(null);
  const anim = useRef<Group>(null);
  const prevAttackAt = useRef(0);
  const swingStart = useRef(-1);
  const swingType = useRef(0);
  const blockAmt = useRef(0);
  const drawAmt = useRef(0);

  useFrame((state) => {
    const root3 = root.current;
    const a = anim.current;
    if (!root3 || !a) return;

    const local = room.state.players.get(localId);
    const rs = room.state.roundState as RoundState;
    const input = inputRef.current;
    const visible =
      local != null &&
      local.alive &&
      (rs === RoundState.Playing || rs === RoundState.Countdown) &&
      input.locked;

    root3.visible = Boolean(visible);
    if (!visible || !local) return;

    // Lock the viewmodel to the camera.
    root3.position.copy(camera.position);
    root3.quaternion.copy(camera.quaternion);

    const nowMs = state.clock.elapsedTime * 1000;

    // Trigger a swing when the server reports a new attack.
    if (local.lastAttackAt !== prevAttackAt.current) {
      prevAttackAt.current = local.lastAttackAt;
      swingStart.current = nowMs;
      swingType.current = local.swingType;
    }

    // Block / charge poses.
    blockAmt.current += ((local.blocking ? 1 : 0) - blockAmt.current) * 0.25;
    drawAmt.current += ((local.charging ? 1 : 0) - drawAmt.current) * 0.3;

    // Idle sway.
    const sway = Math.sin(state.clock.elapsedTime * 1.6) * 0.012;

    // Base pose (camera-local space, -Z is forward).
    let px = 0.34;
    let py = -0.36 + sway;
    let pz = -0.72;
    let rx = 0.05;
    let ry = -0.25;
    let rz = 0.0;

    // Block: bring the weapon/shield up and across.
    px += (-0.18 - px + 0.34) * blockAmt.current;
    py += 0.16 * blockAmt.current;
    pz += 0.12 * blockAmt.current;
    rz += 0.7 * blockAmt.current;
    rx += -0.3 * blockAmt.current;

    // Bow draw: pull the hand back.
    pz += 0.18 * drawAmt.current;
    px += -0.08 * drawAmt.current;

    // Swing animation.
    const t = swingStart.current >= 0 ? (nowMs - swingStart.current) / SWING_MS : 2;
    if (t < 1) {
      const e = Math.sin(Math.min(1, t) * Math.PI); // 0→1→0
      if (swingType.current === 2) {
        rx += -e * 1.7; // overhead / stab
        pz += -e * 0.25;
      } else if (swingType.current === 1) {
        rz += -e * 1.6; // right-to-left
        px += -e * 0.3;
      } else {
        rz += e * 1.6; // left-to-right
        px += e * 0.3;
      }
    }

    a.position.set(px, py, pz);
    a.rotation.set(rx, ry, rz);
  });

  const local = room.state.players.get(localId);
  const weapon = getWeapon(local?.weapon ?? 'sword');
  const accent = PLAYER_COLORS[local?.colorIndex ?? 0] ?? '#3b82f6';

  return (
    <group ref={root}>
      <group ref={anim}>
        {/* Right gloved hand/forearm */}
        <mesh position={[0, -0.08, 0.18]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.16, 0.16, 0.4]} />
          <meshStandardMaterial color="#6b4f33" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.04, 0.0]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={accent} roughness={0.7} />
        </mesh>
        {/* The weapon itself */}
        <group position={[0, 0, -0.1]}>
          <WeaponModel weapon={weapon.id} scale={1} />
        </group>
      </group>
    </group>
  );
}
