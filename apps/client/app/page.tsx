'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { generateRoomCode } from '@arena/shared';

export default function MainMenu() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  const playerName = name.trim() || 'Player';

  function createRoom(): void {
    const code = generateRoomCode();
    router.push(
      `/game?code=${code}&name=${encodeURIComponent(playerName)}&host=1`,
    );
  }

  function joinRoom(): void {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(`/game?code=${code}&name=${encodeURIComponent(playerName)}`);
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="w-[420px] rounded-2xl border border-slate-700/60 bg-slate-900/70 p-8 shadow-2xl backdrop-blur">
        <h1 className="mb-1 text-center text-4xl font-black tracking-tight text-white">
          ⚔️ Arena Brawlers
        </h1>
        <p className="mb-6 text-center text-sm text-slate-400">
          Knock your friends off the floating arena. Last one standing wins.
        </p>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Your name
        </label>
        <input
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player"
          className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-sky-500"
        />

        {mode === 'menu' ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={createRoom}
              className="w-full rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-500"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white transition hover:bg-slate-600"
            >
              Join Room
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              value={joinCode}
              maxLength={6}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              placeholder="ROOM CODE"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-center text-2xl font-bold tracking-[0.4em] text-white outline-none focus:border-sky-500"
            />
            <button
              onClick={joinRoom}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-500"
            >
              Join Game
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full rounded-lg px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200"
            >
              ← Back
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-400">Controls</p>
          <p>WASD move · Space jump (double-jump) · Shift dash</p>
          <p>Left-click attack · Right-click block</p>
        </div>
      </div>
    </div>
  );
}
