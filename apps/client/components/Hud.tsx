'use client';

import { useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import {
  RoundState,
  PLAYER_COLORS,
  PLAYER_COLOR_NAMES,
  MAX_HP,
  TARGET_SCORE,
  getWeapon,
  RARITY_COLOR,
  type PlayerState,
} from '@arena/shared';
import type { ArenaRoom } from '@/lib/network';
import { audio } from '@/lib/audio';

export function Hud({
  room,
  localId,
  inputEnabledRef,
}: {
  room: ArenaRoom;
  localId: string;
  inputEnabledRef: React.MutableRefObject<boolean>;
}) {
  const router = useRouter();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // Re-render the HUD whenever authoritative state changes.
  useEffect(() => {
    room.onStateChange(() => forceRender());
  }, [room]);

  const state = room.state;
  const local = state.players.get(localId);
  const players: PlayerState[] = [];
  state.players.forEach((p) => players.push(p));
  players.sort((a, b) => a.colorIndex - b.colorIndex);

  // Steering is allowed only while alive and the round is live.
  inputEnabledRef.current = Boolean(local?.alive) && state.roundState === RoundState.Playing;

  const roundState = state.roundState as RoundState;

  // Crowd audio reacts to the round flow.
  useEffect(() => {
    switch (roundState) {
      case RoundState.Playing:
        audio.setCrowdIntensity(0.45);
        audio.cheer(0.4);
        break;
      case RoundState.RoundEnd:
        audio.setCrowdIntensity(0.9);
        audio.cheer(0.85);
        break;
      case RoundState.MatchEnd:
        audio.setCrowdIntensity(1);
        audio.cheer(1);
        break;
      default:
        audio.setCrowdIntensity(0.15);
        break;
    }
  }, [roundState]);

  const isSpectating = Boolean(local && !local.alive) && roundState === RoundState.Playing;
  const weapon = getWeapon(local?.weapon ?? 'sword');

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-sans">
      {/* Scoreboard — top center */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/70 px-4 py-2 shadow-lg backdrop-blur">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 px-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: PLAYER_COLORS[p.colorIndex] }}
              />
              <span className="text-sm font-semibold text-white">{p.name}</span>
              <span className="text-sm font-black tabular-nums text-amber-300">{p.score}</span>
            </div>
          ))}
          <span className="ml-1 text-xs text-slate-500">first to {TARGET_SCORE}</span>
        </div>
      </div>

      {/* Room code — top right */}
      <div className="absolute right-3 top-3 rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-right backdrop-blur">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Room</div>
        <div className="font-mono text-lg font-bold tracking-[0.3em] text-white">{state.code}</div>
      </div>

      {/* Local health — top left */}
      {local && (
        <div className="absolute left-3 top-3 w-56 rounded-lg border border-slate-700/60 bg-slate-900/70 p-3 backdrop-blur">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold" style={{ color: PLAYER_COLORS[local.colorIndex] }}>
              {local.name} ({PLAYER_COLOR_NAMES[local.colorIndex]})
            </span>
            <span className="tabular-nums text-slate-300">{Math.ceil(local.hp)} HP</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full rounded transition-[width] duration-150"
              style={{
                width: `${Math.max(0, (local.hp / MAX_HP) * 100)}%`,
                background:
                  local.hp / MAX_HP > 0.4 ? PLAYER_COLORS[local.colorIndex] : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

      {/* Crosshair — only while actively fighting */}
      {local && local.alive && roundState === RoundState.Playing && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-5 w-5 opacity-80">
            <span className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-white/90" />
            <span className="absolute bottom-0 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-white/90" />
            <span className="absolute top-1/2 left-0 h-[2px] w-2 -translate-y-1/2 bg-white/90" />
            <span className="absolute top-1/2 right-0 h-[2px] w-2 -translate-y-1/2 bg-white/90" />
            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </div>
        </div>
      )}

      {/* Current weapon — bottom center */}
      {local && local.alive && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 px-4 py-2 backdrop-blur">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: RARITY_COLOR[weapon.rarity] }} />
            <span className="text-sm font-bold" style={{ color: RARITY_COLOR[weapon.rarity] }}>
              {weapon.name}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">{weapon.rarity}</span>
            {Number.isFinite(weapon.uses) && (
              <span className="rounded bg-slate-800 px-1.5 text-xs font-semibold text-amber-300">
                ×{local.weaponUses}
              </span>
            )}
            {local.charging && <span className="text-xs font-semibold text-emerald-400">drawing…</span>}
          </div>
        </div>
      )}

      {/* Center round messages */}
      <CenterMessage state={room} roundState={roundState} />

      {/* Spectator banner */}
      {isSpectating && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-5 py-2 text-sm font-semibold text-slate-200 backdrop-blur">
          💀 You were knocked out — waiting for next round…
        </div>
      )}

      {/* Match-end overlay */}
      {roundState === RoundState.MatchEnd && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <MatchWinner room={room} />
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => room.send('playAgain')}
              className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="rounded-lg bg-slate-700 px-6 py-3 font-semibold text-white hover:bg-slate-600"
            >
              Return to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CenterMessage({ state, roundState }: { state: ArenaRoom; roundState: RoundState }) {
  if (roundState === RoundState.MatchEnd) return null;

  const showCountdown =
    roundState === RoundState.Countdown && state.state.countdown > 0;

  return (
    <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 text-center">
      {showCountdown ? (
        <div
          key={state.state.countdown}
          className="animate-pop text-8xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)]"
        >
          {state.state.countdown}
        </div>
      ) : (
        <div
          key={state.state.message}
          className="animate-pop rounded-xl bg-black/40 px-6 py-3 text-3xl font-black text-white drop-shadow-lg"
        >
          {state.state.message}
        </div>
      )}
      {roundState === RoundState.RoundEnd && (
        <div className="mt-2 text-sm text-slate-300">
          Next round in {state.state.countdown}…
        </div>
      )}
    </div>
  );
}

function MatchWinner({ room }: { room: ArenaRoom }) {
  const winner = room.state.players.get(room.state.matchWinnerId);
  const color = winner ? PLAYER_COLORS[winner.colorIndex] : '#fff';
  return (
    <div className="text-center">
      <div className="text-sm uppercase tracking-[0.3em] text-amber-300">Match Winner</div>
      <div className="animate-pop mt-2 text-6xl font-black" style={{ color }}>
        🏆 {winner?.name ?? 'Nobody'}
      </div>
      <div className="mt-2 text-lg text-slate-300">{room.state.message}</div>
    </div>
  );
}
