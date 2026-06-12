'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  RoundState,
  stepKinematics,
  createTransient,
  type InputMessage,
  type KinematicBody,
  type KinematicTransient,
} from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import type { InputState } from '@/lib/input';
import { ArenaMesh } from '@/components/ArenaMesh';
import { PlayerView } from '@/components/PlayerView';
import { CrateView } from '@/components/CrateView';
import { CameraRig } from '@/components/CameraRig';

/** Predicted local-player pose, read by the local PlayerView each frame. */
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

  const pred = useMemo<PredState>(
    () => ({
      body: { x: 0, y: 2, z: 0, vx: 0, vy: 0, vz: 0, facing: 1 },
      transient: createTransient(),
      initialized: false,
    }),
    [],
  );

  // Track the set of players / crates; only re-render when the *set* changes.
  useEffect(() => {
    const sync = () => {
      const p: string[] = [];
      room.state.players.forEach((_v, k) => p.push(k));
      const c: string[] = [];
      room.state.crates.forEach((_v, k) => c.push(k));
      setPlayerIds((prev) => (sameSet(prev, p) ? prev : p));
      setCrateIds((prev) => (sameSet(prev, c) ? prev : c));
    };
    room.onStateChange(sync);
    sync();
  }, [room]);

  return (
    <>
      <color attach="background" args={['#0b1120']} />
      <fog attach="fog" args={['#0b1120', 40, 90]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 12]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={['#a5b4fc', '#1e293b', 0.5]} />

      <ArenaMesh />

      {playerIds.map((id) => (
        <PlayerView
          key={id}
          room={room}
          id={id}
          local={id === localId}
          pred={pred}
        />
      ))}

      {crateIds.map((id) => (
        <CrateView key={id} room={room} id={id} />
      ))}

      <CameraRig room={room} localId={localId} pred={pred} />
      <PredictionLoop room={room} localId={localId} inputRef={inputRef} pred={pred} />
    </>
  );
}

/**
 * Per-frame loop: samples input, sends it to the server, runs client-side
 * prediction for the local player, and reconciles against the authoritative
 * state. Renders nothing.
 */
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

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const now = performance.now();
    const local = room.state.players.get(localId);
    if (!local) return;

    const input = inputRef.current;
    const playing = room.state.roundState === RoundState.Playing;
    const enabled = local.alive && playing;

    // Consume one-shot edges.
    const jump = input.jumpQueued;
    const dash = input.dashQueued;
    const attack = input.attackQueued;
    input.jumpQueued = false;
    input.dashQueued = false;
    input.attackQueued = false;

    seq.current += 1;
    const msg: InputMessage = {
      seq: seq.current,
      moveX: enabled ? input.moveX : 0,
      // A little depth control, kept subtle so the side-view stays readable.
      moveZ: enabled ? input.moveZ * 0.5 : 0,
      jump: enabled && jump,
      dash: enabled && dash,
      block: enabled && input.block,
      facing: input.facing,
    };

    room.send('input', msg);
    if (enabled && attack) {
      room.send('attack', { seq: seq.current });
    }

    // --- prediction + reconciliation ---
    if (!pred.initialized || !enabled) {
      snapTo(pred, local);
      pred.initialized = true;
      return;
    }

    stepKinematics(pred.body, pred.transient, msg, delta, now);

    const ex = local.x - pred.body.x;
    const ey = local.y - pred.body.y;
    const ez = local.z - pred.body.z;
    const err = Math.hypot(ex, ey, ez);
    if (err > 3) {
      snapTo(pred, local);
    } else {
      pred.body.x += ex * 0.25;
      pred.body.y += ey * 0.25;
      pred.body.z += ez * 0.25;
      pred.body.vx += (local.vx - pred.body.vx) * 0.3;
      pred.body.vy += (local.vy - pred.body.vy) * 0.3;
      pred.body.vz += (local.vz - pred.body.vz) * 0.3;
    }
  });

  return null;
}

function snapTo(pred: PredState, p: { x: number; y: number; z: number; vx: number; vy: number; vz: number; facing: number }): void {
  pred.body.x = p.x;
  pred.body.y = p.y;
  pred.body.z = p.z;
  pred.body.vx = p.vx;
  pred.body.vy = p.vy;
  pred.body.vz = p.vz;
  pred.body.facing = p.facing;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
