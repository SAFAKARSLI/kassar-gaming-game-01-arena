'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Three.js cannot server-render, so load the game client-only.
const Game = dynamic(() => import('@/components/Game'), { ssr: false });

function GameInner() {
  const params = useSearchParams();
  const code = (params.get('code') ?? '').toUpperCase();
  const name = params.get('name') ?? 'Player';
  const host = params.get('host') === '1';

  if (!code) {
    return (
      <div className="flex h-full items-center justify-center text-slate-300">
        Missing room code.
      </div>
    );
  }

  return <Game code={code} name={name} host={host} />;
}

export default function GamePage() {
  return (
    <Suspense
      fallback={<div className="flex h-full items-center justify-center text-slate-300">Loading…</div>}
    >
      <GameInner />
    </Suspense>
  );
}
