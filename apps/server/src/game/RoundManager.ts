/**
 * Server-side round/match flow controller.
 *
 *   Waiting → Countdown → Playing → (one alive) → RoundEnd → Countdown → ...
 *                                                      ↓ (target score)
 *                                                   MatchEnd
 *
 * It owns no transforms or physics — it only reads/writes round state, scores
 * and orchestrates respawns through the room.
 */

import {
  COUNTDOWN_MS,
  MAX_HP,
  ROUND_END_MS,
  RoundState,
  TARGET_SCORE,
  PLAYER_COLOR_NAMES,
  type ArenaState,
  type PlayerState,
} from '@arena/shared';

export interface RoundHost {
  state: ArenaState;
  respawnAll(): void;
  clearCrates(): void;
  clearEntities(): void;
}

export class RoundManager {
  private timer = 0; // ms remaining in timed states (countdown / round-end)

  constructor(private readonly host: RoundHost) {}

  private get state(): ArenaState {
    return this.host.state;
  }

  private connectedPlayers(): PlayerState[] {
    const list: PlayerState[] = [];
    this.state.players.forEach((p) => {
      if (p.connected) list.push(p);
    });
    return list;
  }

  private alivePlayers(): PlayerState[] {
    return this.connectedPlayers().filter((p) => p.alive);
  }

  /** Called every server tick with the elapsed milliseconds. */
  update(deltaMs: number): void {
    switch (this.state.roundState) {
      case RoundState.Waiting:
        this.tickWaiting();
        break;
      case RoundState.Countdown:
        this.tickCountdown(deltaMs);
        break;
      case RoundState.Playing:
        this.tickPlaying();
        break;
      case RoundState.RoundEnd:
        this.tickRoundEnd(deltaMs);
        break;
      case RoundState.MatchEnd:
        // Idle until a client requests "playAgain".
        break;
      default:
        break;
    }
  }

  private tickWaiting(): void {
    if (this.connectedPlayers().length >= 2) {
      this.startCountdown();
    } else {
      this.state.message = 'Waiting for players...';
    }
  }

  private startCountdown(): void {
    this.host.respawnAll();
    this.host.clearCrates();
    this.host.clearEntities();
    this.state.roundState = RoundState.Countdown;
    this.state.roundWinnerId = '';
    this.timer = COUNTDOWN_MS;
    this.state.countdown = Math.ceil(COUNTDOWN_MS / 1000);
    this.state.message = 'Get ready...';
  }

  private tickCountdown(deltaMs: number): void {
    if (this.connectedPlayers().length < 2) {
      this.state.roundState = RoundState.Waiting;
      return;
    }
    this.timer -= deltaMs;
    this.state.countdown = Math.max(0, Math.ceil(this.timer / 1000));
    if (this.timer <= 0) {
      this.state.roundState = RoundState.Playing;
      this.state.countdown = 0;
      this.state.message = 'Round Start!';
    }
  }

  private tickPlaying(): void {
    const connected = this.connectedPlayers();
    if (connected.length < 2) {
      // Everyone but one (or none) left — abandon the round.
      this.state.roundState = RoundState.Waiting;
      this.state.message = 'Waiting for players...';
      return;
    }

    const alive = this.alivePlayers();
    if (alive.length <= 1) {
      const winner = alive[0];
      this.endRound(winner);
    }
  }

  private endRound(winner: PlayerState | undefined): void {
    if (winner) {
      winner.score += 1;
      this.state.roundWinnerId = winner.id;
      const colorName = PLAYER_COLOR_NAMES[winner.colorIndex] ?? winner.name;
      this.state.message = `${winner.name} (${colorName}) wins the round!`;

      if (winner.score >= TARGET_SCORE) {
        this.state.roundState = RoundState.MatchEnd;
        this.state.matchWinnerId = winner.id;
        this.state.message = `${winner.name} wins the match!`;
        return;
      }
    } else {
      this.state.roundWinnerId = '';
      this.state.message = 'Draw!';
    }

    this.state.roundState = RoundState.RoundEnd;
    this.timer = ROUND_END_MS;
    this.state.countdown = Math.ceil(ROUND_END_MS / 1000);
  }

  private tickRoundEnd(deltaMs: number): void {
    this.timer -= deltaMs;
    this.state.countdown = Math.max(0, Math.ceil(this.timer / 1000));
    if (this.timer <= 0) {
      if (this.connectedPlayers().length >= 2) {
        this.startCountdown();
      } else {
        this.state.roundState = RoundState.Waiting;
      }
    }
  }

  /** Reset scores and start a fresh match (triggered by a client "playAgain"). */
  playAgain(): void {
    this.state.players.forEach((p) => {
      p.score = 0;
      p.hp = MAX_HP;
    });
    this.state.matchWinnerId = '';
    this.state.roundWinnerId = '';
    this.startCountdown();
  }

  /** Re-evaluate when a player joins/leaves outside the normal tick cadence. */
  onRosterChanged(): void {
    if (
      this.state.roundState === RoundState.Waiting &&
      this.connectedPlayers().length >= 2
    ) {
      this.startCountdown();
    }
  }
}
