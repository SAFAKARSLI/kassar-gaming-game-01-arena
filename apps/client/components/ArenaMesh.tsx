'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundState } from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import { Sky } from '@/components/arena/Sky';
import { ArenaStructure } from '@/components/arena/ArenaStructure';
import { Crowd } from '@/components/arena/Crowd';
import { Torches } from '@/components/arena/Torches';

/**
 * The full medieval gladiator arena: sky, sand pit, stone walls + gates,
 * spectator stands with a cheering crowd, towers, banners and torches.
 *
 * Crowd excitement and the gate doors react to the round state.
 */
export function ArenaMesh({ room }: { room: ArenaRoom }) {
  const cheerRef = useRef(0.12);
  const doorsOpenRef = useRef(0);

  useFrame((_state, delta) => {
    const rs = room.state.roundState as RoundState;

    // Target crowd excitement.
    let cheerTarget = 0.12;
    if (rs === RoundState.Playing) cheerTarget = 0.4;
    else if (rs === RoundState.RoundEnd) cheerTarget = 0.85;
    else if (rs === RoundState.MatchEnd) cheerTarget = 1;
    cheerRef.current += (cheerTarget - cheerRef.current) * Math.min(1, delta * 2.5);

    // Gates open once the round is live (and during the count-in), closed otherwise.
    const doorsTarget =
      rs === RoundState.Playing || rs === RoundState.Countdown ? 1 : 0;
    doorsOpenRef.current += (doorsTarget - doorsOpenRef.current) * Math.min(1, delta * 2);
  });

  return (
    <group>
      <Sky />
      <ArenaStructure doorsOpenRef={doorsOpenRef} />
      <Crowd cheerRef={cheerRef} />
      <Torches />
    </group>
  );
}
