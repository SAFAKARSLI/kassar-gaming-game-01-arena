/**
 * The authoritative game room. Owns all positions, health, weapons, damage,
 * knockback and round state. Clients send only input + attack requests.
 */

import { Room, Client } from '@colyseus/core';
import {
  ArenaState,
  PlayerState,
  CrateState,
  RoundState,
  EMPTY_INPUT,
  MAX_PLAYERS,
  MAX_HP,
  MAX_CRATES,
  CRATE_SIZE,
  CRATE_SPAWN_MIN_MS,
  CRATE_SPAWN_MAX_MS,
  CRATE_SPAWN_POINTS,
  TICK_RATE,
  DEATH_Y,
  PLAYER_RADIUS,
  BLOCK_REDUCTION,
  DEFAULT_WEAPON,
  SPAWN_POINTS,
  getWeapon,
  randomCrateWeapon,
  stepKinematics,
  applyKnockback,
  effectiveKnockback,
  createTransient,
  type InputMessage,
  type KinematicTransient,
} from '@arena/shared';
import { RoundManager, type RoundHost } from '../game/RoundManager';

interface JoinOpts {
  name?: string;
  code?: string;
}

export class ArenaRoom extends Room<ArenaState> implements RoundHost {
  maxClients = MAX_PLAYERS;

  private readonly transients = new Map<string, KinematicTransient>();
  private readonly inputs = new Map<string, InputMessage>();
  private round!: RoundManager;
  private nextCrateAt = 0;
  private crateSeq = 0;

  override onCreate(options: JoinOpts): void {
    const state = new ArenaState();
    state.code = (options.code ?? '').toUpperCase();
    this.setState(state);

    this.round = new RoundManager(this);
    this.nextCrateAt = Date.now() + this.randomCrateDelay();

    this.onMessage('input', (client, message: InputMessage) => {
      this.handleInput(client.sessionId, message);
    });

    this.onMessage('attack', (client) => {
      this.handleAttack(client.sessionId);
    });

    this.onMessage('playAgain', () => {
      if (this.state.roundState === RoundState.MatchEnd) {
        this.round.playAgain();
      }
    });

    // Fixed-rate authoritative simulation.
    this.setSimulationInterval((deltaMs) => this.update(deltaMs), 1000 / TICK_RATE);
  }

  override onJoin(client: Client, options: JoinOpts): void {
    const index = this.state.players.size;
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = (options.name ?? `Player ${index + 1}`).slice(0, 16) || `Player ${index + 1}`;
    player.colorIndex = index % MAX_PLAYERS;
    player.weapon = DEFAULT_WEAPON;
    player.connected = true;

    // Mid-round joiners spectate until the next respawn.
    const inRound =
      this.state.roundState === RoundState.Playing ||
      this.state.roundState === RoundState.RoundEnd;
    player.alive = !inRound;
    this.placeAtSpawn(player, index);

    this.state.players.set(client.sessionId, player);
    this.transients.set(client.sessionId, createTransient());
    this.inputs.set(client.sessionId, { ...EMPTY_INPUT });

    this.round.onRosterChanged();
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.transients.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.round.onRosterChanged();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private handleInput(sessionId: string, message: InputMessage): void {
    const prev = this.inputs.get(sessionId);
    if (!prev) return;
    // Merge sticky one-shot flags (jump/dash) so edges aren't lost between ticks.
    this.inputs.set(sessionId, {
      seq: message.seq,
      moveX: clamp(message.moveX, -1, 1),
      moveZ: clamp(message.moveZ, -1, 1),
      jump: prev.jump || message.jump === true,
      dash: prev.dash || message.dash === true,
      block: message.block === true,
      facing: message.facing >= 0 ? 1 : -1,
    });
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  private update(deltaMs: number): void {
    const now = Date.now();
    const dt = Math.min(deltaMs, 50) / 1000;
    const playing = this.state.roundState === RoundState.Playing;

    this.state.players.forEach((player) => {
      const t = this.transients.get(player.id);
      const input = this.inputs.get(player.id);
      if (!t || !input) return;

      if (player.alive && playing) {
        stepKinematics(player, t, input, dt, now);
        player.blocking = input.block;
        player.dashing = t.dashing;

        // Consume one-shot inputs.
        input.jump = false;
        input.dash = false;

        // Fell off the map.
        if (player.y < DEATH_Y) {
          this.killPlayer(player);
        }
      } else {
        player.blocking = false;
        player.dashing = false;
        // Keep spectators visually idle.
        player.vx = 0;
        player.vy = 0;
        player.vz = 0;
      }
    });

    if (playing) {
      this.updateCrates(now);
    }

    this.round.update(deltaMs);
  }

  // -------------------------------------------------------------------------
  // Combat
  // -------------------------------------------------------------------------

  private handleAttack(sessionId: string): void {
    if (this.state.roundState !== RoundState.Playing) return;
    const attacker = this.state.players.get(sessionId);
    if (!attacker || !attacker.alive || attacker.blocking) return;

    const weapon = getWeapon(attacker.weapon);
    const now = Date.now();
    if (now - attacker.lastAttackAt < weapon.attackSpeedMs) return;
    attacker.lastAttackAt = now;

    this.state.players.forEach((victim) => {
      if (victim.id === attacker.id || !victim.alive) return;

      const dx = victim.x - attacker.x;
      const dy = victim.y - attacker.y;
      const dz = victim.z - attacker.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > weapon.range + PLAYER_RADIUS) return;

      // Must be roughly in front of the attacker (unless almost on top of them).
      if (Math.abs(dx) > 0.4 && Math.sign(dx) !== attacker.facing) return;

      this.applyDamage(attacker, victim, weapon.damage, weapon.knockback);
    });
  }

  private applyDamage(
    attacker: PlayerState,
    victim: PlayerState,
    baseDamage: number,
    baseKnockback: number,
  ): void {
    const blockFactor = victim.blocking ? 1 - BLOCK_REDUCTION : 1;
    const damage = baseDamage * blockFactor;

    victim.hp = Math.max(0, victim.hp - damage);
    victim.lastHitAt = Date.now();

    // Knockback uses the *post-damage* hp so lower-health players fly farther.
    const knockMag = effectiveKnockback(baseKnockback * blockFactor, victim.hp);
    const t = this.transients.get(victim.id);
    if (t) {
      applyKnockback(victim, t, knockMag, attacker.x, attacker.z);
    }

    this.broadcast('hit', {
      attackerId: attacker.id,
      victimId: victim.id,
      damage,
      weapon: attacker.weapon,
    });

    if (victim.hp <= 0) {
      this.killPlayer(victim);
    }
  }

  private killPlayer(player: PlayerState): void {
    player.alive = false;
    player.hp = 0;
    player.blocking = false;
    player.dashing = false;
  }

  // -------------------------------------------------------------------------
  // Crates
  // -------------------------------------------------------------------------

  private updateCrates(now: number): void {
    // Spawn on a timer up to the cap.
    if (now >= this.nextCrateAt && this.state.crates.size < MAX_CRATES) {
      this.spawnCrate();
      this.nextCrateAt = now + this.randomCrateDelay();
    }

    // Pickup detection.
    const pickupDist = PLAYER_RADIUS + CRATE_SIZE * 0.7;
    this.state.crates.forEach((crate) => {
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        const dist = Math.hypot(player.x - crate.x, player.y - crate.y, player.z - crate.z);
        if (dist <= pickupDist) {
          player.weapon = crate.weapon;
          this.state.crates.delete(crate.id);
        }
      });
    });
  }

  private spawnCrate(): void {
    const occupied = new Set<number>();
    this.state.crates.forEach((c) => {
      const idx = Number(c.id.split(':')[1] ?? -1);
      if (!Number.isNaN(idx)) occupied.add(idx);
    });

    const free: number[] = [];
    CRATE_SPAWN_POINTS.forEach((_, i) => {
      if (!occupied.has(i)) free.push(i);
    });
    if (free.length === 0) return;

    const pointIndex = free[Math.floor(Math.random() * free.length)] ?? 0;
    const point = CRATE_SPAWN_POINTS[pointIndex];
    if (!point) return;

    const crate = new CrateState();
    this.crateSeq += 1;
    crate.id = `crate:${pointIndex}:${this.crateSeq}`;
    crate.x = point.x;
    crate.y = point.y;
    crate.z = point.z;
    crate.weapon = randomCrateWeapon();
    this.state.crates.set(crate.id, crate);
  }

  private randomCrateDelay(): number {
    return CRATE_SPAWN_MIN_MS + Math.random() * (CRATE_SPAWN_MAX_MS - CRATE_SPAWN_MIN_MS);
  }

  // -------------------------------------------------------------------------
  // RoundHost implementation
  // -------------------------------------------------------------------------

  respawnAll(): void {
    let index = 0;
    this.state.players.forEach((player) => {
      this.placeAtSpawn(player, index);
      player.hp = MAX_HP;
      player.alive = true;
      player.weapon = DEFAULT_WEAPON;
      player.blocking = false;
      player.dashing = false;
      player.lastAttackAt = 0;
      player.lastHitAt = 0;

      const t = this.transients.get(player.id);
      if (t) {
        t.grounded = false;
        t.jumps = 0;
        t.stun = 0;
        t.lastDashAt = 0;
        t.dashing = false;
      }
      const input = this.inputs.get(player.id);
      if (input) {
        input.jump = false;
        input.dash = false;
      }
      index += 1;
    });
  }

  clearCrates(): void {
    this.state.crates.clear();
    this.nextCrateAt = Date.now() + this.randomCrateDelay();
  }

  private placeAtSpawn(player: PlayerState, index: number): void {
    const point = SPAWN_POINTS[index % SPAWN_POINTS.length] ?? { x: 0, y: 2, z: 0 };
    player.x = point.x;
    player.y = point.y;
    player.z = point.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.facing = point.x <= 0 ? 1 : -1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
