'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { EYE_OFFSET, RoundState, yawForward } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import type { InputState } from '@/lib/input';
import type { PredState } from '@/components/Scene';

/**
 * First-person camera through the gladiator's eyes — yaw/pitch from the mouse,
 * with subtle head bob while moving and a small dip on landing. Falls back to a
 * spectator follow-cam when the local player is dead.
 */
export function CameraRig({
  room,
  localId,
  pred,
  inputRef,
}: {
  room: ArenaRoom;
  localId: string;
  pred: PredState;
  inputRef: React.MutableRefObject<InputState>;
}) {
  const { camera } = useThree();
  const bobPhase = useRef(0);
  const dip = useRef(0);
  const specPos = useRef(new Vector3(0, 6, 20));

  useFrame((_state, delta) => {
    const local = room.state.players.get(localId);
    const rs = room.state.roundState as RoundState;
    const input = inputRef.current;

    const firstPerson =
      local != null &&
      local.alive &&
      (rs === RoundState.Playing || rs === RoundState.Countdown || rs === RoundState.Waiting);

    if (firstPerson && local) {
      const px = pred.initialized ? pred.body.x : local.x;
      const py = pred.initialized ? pred.body.y : local.y;
      const pz = pred.initialized ? pred.body.z : local.z;

      // Head bob while moving on the ground.
      const moving =
        (input.forward || input.back || input.left || input.right) && pred.transient.grounded;
      bobPhase.current += delta * (moving ? 11 : 0);
      const bob = moving ? Math.sin(bobPhase.current) * 0.045 : 0;
      const sway = moving ? Math.cos(bobPhase.current * 0.5) * 0.03 : 0;

      // Landing dip.
      if (pred.transient.justLanded) {
        dip.current = Math.min(0.28, Math.abs(pred.transient.landSpeed) * 0.016);
      }
      dip.current *= 0.82;

      camera.position.set(px + sway, py + EYE_OFFSET + bob - dip.current, pz);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(input.pitch, -input.yaw, moving ? Math.sin(bobPhase.current) * 0.008 : 0);
      return;
    }

    // Spectator — follow a living player from behind, or survey the arena.
    let target: { x: number; y: number; z: number; yaw: number } | null = null;
    room.state.players.forEach((p) => {
      if (!target && p.alive) target = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    });
    if (target) {
      const t = target as { x: number; y: number; z: number; yaw: number };
      const f = yawForward(t.yaw);
      specPos.current.lerp(new Vector3(t.x - f.x * 6, t.y + 3.2, t.z - f.z * 6), 0.06);
      camera.position.copy(specPos.current);
      camera.rotation.order = 'YXZ';
      camera.lookAt(t.x, t.y + 1, t.z);
    } else {
      specPos.current.lerp(new Vector3(0, 9, 22), 0.05);
      camera.position.copy(specPos.current);
      camera.lookAt(0, 2, 0);
    }
  });

  return null;
}
