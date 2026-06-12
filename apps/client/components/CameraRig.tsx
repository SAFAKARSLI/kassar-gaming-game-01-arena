'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useRef } from 'react';
import type { ArenaRoom } from '@/lib/network';
import type { PredState } from '@/components/Scene';

/**
 * Smash-style side camera: fixed on the +Z side looking toward the arena,
 * follows the centroid of living players and zooms out as they spread apart.
 */
export function CameraRig({
  room,
  localId,
  pred,
}: {
  room: ArenaRoom;
  localId: string;
  pred: PredState;
}) {
  const { camera } = useThree();
  const lookTarget = useRef(new Vector3(0, 2, 0));
  const desired = useRef(new Vector3(0, 5, 22));

  useFrame(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    room.state.players.forEach((p) => {
      if (!p.alive) return;
      const x = p.id === localId && pred.initialized ? pred.body.x : p.x;
      const y = p.id === localId && pred.initialized ? pred.body.y : p.y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      sumX += x;
      sumY += y;
      count += 1;
    });

    if (count === 0) {
      // Spectating with no one alive — frame the whole arena.
      minX = -8;
      maxX = 8;
      sumX = 0;
      sumY = 4;
      count = 1;
    }

    const centerX = sumX / count;
    const centerY = sumY / count;
    const spread = Math.max(0, maxX - minX);

    const dist = clamp(17 + spread * 0.7, 17, 32);
    desired.current.set(centerX * 0.7, 4 + centerY * 0.25, dist);
    camera.position.lerp(desired.current, 0.08);

    lookTarget.current.lerp(new Vector3(centerX * 0.7, Math.max(1.5, centerY * 0.4 + 1), 0), 0.1);
    camera.lookAt(lookTarget.current);
  });

  return null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
