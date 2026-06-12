'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { connectToRoom, type ArenaRoom } from '@/lib/network';
import { useInput } from '@/lib/input';
import { Scene } from '@/components/Scene';
import { Hud } from '@/components/Hud';

interface GameProps {
  code: string;
  name: string;
  host: boolean;
}

type Status = 'connecting' | 'connected' | 'error';

export default function Game({ code, name, host }: GameProps) {
  const router = useRouter();
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState('');
  const [localId, setLocalId] = useState('');

  // Spectators stop steering; the input hook reads this ref live.
  const inputEnabledRef = useRef(true);
  const inputRef = useInput(inputEnabledRef);

  useEffect(() => {
    let active = true;
    let joined: ArenaRoom | null = null;

    connectToRoom(host, code, name)
      .then((r) => {
        if (!active) {
          void r.leave();
          return;
        }
        joined = r;
        setRoom(r);
        setLocalId(r.sessionId);
        setStatus('connected');
        // Transient combat feedback channel. Hit flashes are already driven by
        // `lastHitAt` in the state; registering a handler keeps the console clean
        // and gives a hook for future VFX (screen shake, particles).
        r.onMessage('hit', () => {});
        r.onError((_c, message) => {
          setError(message ?? 'Connection error');
          setStatus('error');
        });
        r.onLeave(() => {
          if (active) {
            setError('Disconnected from server.');
            setStatus('error');
          }
        });
      })
      .catch((e: unknown) => {
        if (!active) return;
        const message =
          e instanceof Error ? e.message : 'Could not connect. Is the server running?';
        setError(message);
        setStatus('error');
      });

    return () => {
      active = false;
      if (joined) void joined.leave();
    };
  }, [host, code, name]);

  if (status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950 text-center">
        <p className="text-xl font-semibold text-red-400">⚠️ {error}</p>
        <p className="max-w-md text-sm text-slate-400">
          {host
            ? 'Make sure the game server is running.'
            : 'Check the room code is correct and the room still exists.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg bg-slate-700 px-5 py-2 font-semibold text-white hover:bg-slate-600"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  if (status === 'connecting' || !room) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-300">
        Connecting to room {code}…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-slate-950">
      <Canvas
        shadows
        camera={{ fov: 45, position: [0, 5, 22], near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <Scene room={room} localId={localId} inputRef={inputRef} />
      </Canvas>
      <Hud room={room} localId={localId} inputEnabledRef={inputEnabledRef} />
    </div>
  );
}
