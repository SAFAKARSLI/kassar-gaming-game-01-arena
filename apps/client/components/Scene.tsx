'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  INPUT_SEND_RATE,
  RoundState,
  stepKinematics,
  createTransient,
  getWeapon,
  type InputMessage,
  type KinematicBody,
  type KinematicTransient,
} from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import type { InputState } from '@/lib/input';
import { audio } from '@/lib/audio';
import { ArenaMesh } from '@/components/ArenaMesh';
import { PlayerView } from '@/components/PlayerView';
import { CrateView } from '@/components/CrateView';
import { CameraRig } from '@/components/CameraRig';
import { FirstPersonViewmodel } from '@/components/FirstPersonViewmodel';
import { Projectiles } from '@/components/Projectiles';
import { Hazards } from '@/components/Hazards';

/** Predicted local-player pose, read by the camera + viewmodel each frame. */
export interface PredState {
  body: KinematicBody;
  transient: KinematicTransient;
  initialized: boolean;
}

interface SceneProps {
  room: ArenaRoom;
  localId: string;
  inputRef: React.MutableRefObject<InputState>;
}

export function Scene({ room, localId, inputRef }: SceneProps) {
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [crateIds, setCrateIds] = useState<string[]>([]);
  const [projIds, setProjIds] = useState<string[]>([]);
  const [hazardIds, setHazardIds] = useState<string[]>([]);

  const pred = useMemo<PredState>(
    () => ({
      body: { x: 0, y: 2, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 },
      transient: createTransient(),
      initialized: false,
    }),
    [],
  );

  useEffect(() => {
    const sync = () => {
      const p: string[] = [];
      room.state.players.forEach((_v, k) => p.push(k));
      const c: string[] = [];
      room.state.crates.forEach((_v, k) => c.push(k));
      const pr: string[] = [];
      room.state.projectiles.forEach((_v, k) => pr.push(k));
      const h: string[] = [];
      room.state.hazards.forEach((_v, k) => h.push(k));
      setPlayerIds((prev) => (sameSet(prev, p) ? prev : p));
      setCrateIds((prev) => (sameSet(prev, c) ? prev : c));
      setProjIds((prev) => (sameSet(prev, pr) ? prev : pr));
      setHazardIds((prev) => (sameSet(prev, h) ? prev : h));
    };
    room.onStateChange(sync);
    sync();
  }, [room]);

  return (
    <>
      <color attach="background" args={['#bcd6f2']} />
      <fog attach="fog" args={['#cfe0f0', 70, 150]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#bcd6f2', '#caa86a', 0.75]} />
      <directionalLight
        position={[14, 34, 26]}
        intensity={1.4}
        color="#fff2cc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0004}
      />

      <ArenaMesh room={room} />

      {playerIds.map((id) => (
        <PlayerView key={id} room={room} id={id} local={id === localId} pred={pred} />
      ))}
      {crateIds.map((id) => (
        <CrateView key={id} room={room} id={id} />
      ))}
      <Projectiles room={room} ids={projIds} />
      <Hazards room={room} ids={hazardIds} />

      <CameraRig room={room} localId={localId} pred={pred} inputRef={inputRef} />
      <FirstPersonViewmodel room={room} localId={localId} inputRef={inputRef} pred={pred} />
      <PredictionLoop room={room} localId={localId} inputRef={inputRef} pred={pred} />
    </>
  );
}

function PredictionLoop({
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
  const seq = useRef(0);
  const lastInputSentAt = useRef(0);

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const now = performance.now();
    const local = room.state.players.get(localId);
    if (!local) return;

    const input = inputRef.current;
    const playing = room.state.roundState === RoundState.Playing;
    const enabled = local.alive && playing && input.locked;

    // Look basis.
    const yaw = input.yaw;
    const cp = Math.cos(input.pitch);
    const aimX = Math.sin(yaw) * cp;
    const aimY = Math.sin(input.pitch);
    const aimZ = -Math.cos(yaw) * cp;

    // World-space movement from WASD relative to yaw.
    const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
    let mz = -Math.cos(yaw) * fwd + Math.sin(yaw) * strafe;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }

    // Consume one-shots.
    const jump = input.jumpQueued;
    const dash = input.dashQueued;
    const useStart = input.useStartQueued;
    const useEnd = input.useEndQueued;
    input.jumpQueued = false;
    input.dashQueued = false;
    input.useStartQueued = false;
    input.useEndQueued = false;

    seq.current += 1;
    const msg: InputMessage = {
      seq: seq.current,
      moveX: enabled ? mx : 0,
      moveZ: enabled ? mz : 0,
      yaw,
      aimX,
      aimY,
      aimZ,
      jump: enabled && jump,
      dash: enabled && dash,
      block: enabled && input.block,
    };
    const sendIntervalMs = 1000 / INPUT_SEND_RATE;
    const shouldSendInput =
      now - lastInputSentAt.current >= sendIntervalMs ||
      msg.jump ||
      msg.dash ||
      useStart ||
      useEnd ||
      msg.block !== local.blocking;
    if (shouldSendInput) {
      lastInputSentAt.current = now;
      room.send('input', msg);
    }

    if (enabled && useStart) {
      room.send('useStart', { yaw, aimX, aimY, aimZ });
      const weapon = getWeapon(local.weapon);
      if (!weapon.charge) audio.swing();
    }
    if (enabled && useEnd) {
      room.send('useEnd', { aimX, aimY, aimZ });
      audio.swing();
    }

    // --- prediction + reconciliation ---
    if (!pred.initialized || !enabled) {
      snapTo(pred, local);
      pred.body.yaw = yaw;
      pred.initialized = true;
      return;
    }
    stepKinematics(pred.body, pred.transient, msg, delta, now);

    const ex = local.x - pred.body.x;
    const ey = local.y - pred.body.y;
    const ez = local.z - pred.body.z;
    if (Math.hypot(ex, ey, ez) > 3) {
      snapTo(pred, local);
    } else {
      pred.body.x += ex * 0.25;
      pred.body.y += ey * 0.25;
      pred.body.z += ez * 0.25;
      pred.body.vx += (local.vx - pred.body.vx) * 0.3;
      pred.body.vy += (local.vy - pred.body.vy) * 0.3;
      pred.body.vz += (local.vz - pred.body.vz) * 0.3;
    }
    pred.body.yaw = yaw;
  });

  return null;
}

function snapTo(
  pred: PredState,
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
): void {
  pred.body.x = p.x;
  pred.body.y = p.y;
  pred.body.z = p.z;
  pred.body.vx = p.vx;
  pred.body.vy = p.vy;
  pred.body.vz = p.vz;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
