/**
 * The authoritative first-person arena room. Owns positions, health, weapons,
 * melee arc traces, projectiles, explosives, traps, damage, knockback and round
 * state. Clients send input (world-move + look) and weapon use requests only.
 */

import { Room, Client } from '@colyseus/core';
import {
  ArenaState,
  PlayerState,
  ProjectileState,
  HazardState,
  CrateState,
  RoundState,
  EMPTY_INPUT,
  MAX_PLAYERS,
  MAX_HP,
  MAX_CRATES,
  MAX_PROJECTILES,
  MAX_HAZARDS,
  CRATE_SIZE,
  CRATE_SPAWN_MIN_MS,
  CRATE_SPAWN_MAX_MS,
  CRATE_SPAWN_POINTS,
  TICK_RATE,
  DEATH_Y,
  EYE_OFFSET,
  PLAYER_RADIUS,
  PROJECTILE_GRAVITY,
  ARROW_GRAVITY,
  PROJECTILE_LIFETIME_MS,
  PROJECTILE_HIT_RADIUS,
  TRAP_LIFETIME_MS,
  TRAP_TRIGGER_RADIUS,
  ARENA_RADIUS,
  BLOCK_FRONT_DOT,
  DEFAULT_WEAPON,
  SPAWN_POINTS,
  getWeapon,
  rollCrateWeapon,
  stepKinematics,
  applyKnockback,
  effectiveKnockback,
  createTransient,
  yawForward,
  type WeaponConfig,
  type InputMessage,
  type UseStartMessage,
  type UseEndMessage,
  type KinematicTransient,
} from '@arena/shared';
import { RoundManager, type RoundHost } from '../game/RoundManager';

interface JoinOpts {
  name?: string;
  code?: string;
}

interface ProjMeta {
  bornAt: number;
  explodeAt: number; // grenade fuse (0 = none)
  charge: number;
}

interface HazardMeta {
  expireAt: number;
  armUntil: number; // mines/spikes ignore the owner until this time
  dotPerSec: number;
  weapon: string;
}

interface PendingSwing {
  attackerId: string;
  weapon: string;
  ax: number;
  az: number;
  resolveAt: number;
}

export class ArenaRoom extends Room<ArenaState> implements RoundHost {
  maxClients = MAX_PLAYERS;

  private readonly transients = new Map<string, KinematicTransient>();
  private readonly inputs = new Map<string, InputMessage>();
  private readonly drawStart = new Map<string, number>();
  private readonly projMeta = new Map<string, ProjMeta>();
  private readonly hazardMeta = new Map<string, HazardMeta>();
  private pendingSwings: PendingSwing[] = [];
  private round!: RoundManager;
  private nextCrateAt = 0;
  private seq = 0;

  override onCreate(options: JoinOpts): void {
    const state = new ArenaState();
    state.code = (options.code ?? '').toUpperCase();
    this.setState(state);

    this.round = new RoundManager(this);
    this.nextCrateAt = Date.now() + this.randomCrateDelay();

    this.onMessage('input', (client, message: InputMessage) => {
      this.handleInput(client.sessionId, message);
    });
    this.onMessage('useStart', (client, message: UseStartMessage) => {
      this.handleUseStart(client.sessionId, message);
    });
    this.onMessage('useEnd', (client, message: UseEndMessage) => {
      this.handleUseEnd(client.sessionId, message);
    });
    this.onMessage('playAgain', () => {
      if (this.state.roundState === RoundState.MatchEnd) this.round.playAgain();
    });

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
    this.drawStart.delete(client.sessionId);
    this.round.onRosterChanged();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private handleInput(sessionId: string, m: InputMessage): void {
    const prev = this.inputs.get(sessionId);
    if (!prev) return;
    this.inputs.set(sessionId, {
      seq: m.seq,
      moveX: clamp(m.moveX, -1, 1),
      moveZ: clamp(m.moveZ, -1, 1),
      yaw: Number.isFinite(m.yaw) ? m.yaw : prev.yaw,
      aimX: m.aimX,
      aimY: m.aimY,
      aimZ: m.aimZ,
      jump: prev.jump || m.jump === true,
      dash: prev.dash || m.dash === true,
      block: m.block === true,
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
        input.jump = false;
        input.dash = false;
        if (player.y < DEATH_Y) this.killPlayer(player);
      } else {
        player.blocking = false;
        player.dashing = false;
        player.charging = false;
        player.vx = 0;
        player.vy = 0;
        player.vz = 0;
      }
    });

    if (playing) {
      this.resolvePendingSwings(now);
      this.updateProjectiles(dt, now);
      this.updateHazards(dt, now);
      this.updateCrates(now);
    }

    this.round.update(deltaMs);
  }

  // -------------------------------------------------------------------------
  // Weapon use dispatch
  // -------------------------------------------------------------------------

  private handleUseStart(sessionId: string, m: UseStartMessage): void {
    if (this.state.roundState !== RoundState.Playing) return;
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) return;
    const weapon = getWeapon(player.weapon);
    const now = Date.now();
    const aim = normalize3(m.aimX, m.aimY, m.aimZ);

    switch (weapon.category) {
      case 'melee':
        this.startMelee(player, weapon, aim, now);
        break;
      case 'ranged':
        if (weapon.charge) {
          player.charging = true;
          this.drawStart.set(sessionId, now);
        } else if (now - player.lastAttackAt >= weapon.cooldownMs) {
          player.lastAttackAt = now;
          this.fireProjectile(player, weapon, aim, 1);
          this.consumeUse(player);
        }
        break;
      case 'thrown':
        if (now - player.lastAttackAt >= weapon.cooldownMs) {
          player.lastAttackAt = now;
          this.fireProjectile(player, weapon, aim, 1);
          this.consumeUse(player);
        }
        break;
      case 'placed':
        if (now - player.lastAttackAt >= weapon.cooldownMs) {
          player.lastAttackAt = now;
          this.placeTrap(player, weapon, now);
          this.consumeUse(player);
        }
        break;
      default:
        break;
    }
  }

  private handleUseEnd(sessionId: string, m: UseEndMessage): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const weapon = getWeapon(player.weapon);
    if (weapon.category !== 'ranged' || !weapon.charge || !player.charging) return;

    player.charging = false;
    const now = Date.now();
    const started = this.drawStart.get(sessionId) ?? now;
    const charge = clamp((now - started) / (weapon.maxDrawMs ?? 800), 0.18, 1);
    if (player.alive && now - player.lastAttackAt >= weapon.cooldownMs) {
      player.lastAttackAt = now;
      this.fireProjectile(player, weapon, normalize3(m.aimX, m.aimY, m.aimZ), charge);
      this.consumeUse(player);
    }
  }

  // -------------------------------------------------------------------------
  // Melee — windup then forward arc/sphere trace
  // -------------------------------------------------------------------------

  private startMelee(player: PlayerState, weapon: WeaponConfig, aim: Vec3, now: number): void {
    if (now - player.lastAttackAt < weapon.cooldownMs) return;
    if (player.blocking) return;
    player.lastAttackAt = now;
    player.swingType = (player.swingType + 1) % 3;
    this.pendingSwings.push({
      attackerId: player.id,
      weapon: weapon.id,
      ax: aim.x,
      az: aim.z,
      resolveAt: now + (weapon.windupMs ?? 120),
    });
  }

  private resolvePendingSwings(now: number): void {
    if (this.pendingSwings.length === 0) return;
    const remaining: PendingSwing[] = [];
    for (const s of this.pendingSwings) {
      if (s.resolveAt > now) {
        remaining.push(s);
        continue;
      }
      this.resolveMelee(s);
    }
    this.pendingSwings = remaining;
  }

  private resolveMelee(swing: PendingSwing): void {
    const attacker = this.state.players.get(swing.attackerId);
    if (!attacker || !attacker.alive) return;
    const weapon = getWeapon(swing.weapon);
    const arc = weapon.arc ?? 0.7;
    const len = Math.hypot(swing.ax, swing.az) || 1;
    const ax = swing.ax / len;
    const az = swing.az / len;

    this.state.players.forEach((victim) => {
      if (victim.id === attacker.id || !victim.alive) return;
      const dx = victim.x - attacker.x;
      const dy = victim.y - attacker.y;
      const dz = victim.z - attacker.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > weapon.range + PLAYER_RADIUS) return;
      const horiz = Math.hypot(dx, dz) || 1;
      const dot = (dx / horiz) * ax + (dz / horiz) * az;
      if (dot < Math.cos(arc)) return; // outside the forward swing arc
      this.applyDamage(attacker.id, victim, weapon, attacker.x, attacker.z, weapon.damage, weapon.knockback);
    });
  }

  // -------------------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------------------

  private fireProjectile(player: PlayerState, weapon: WeaponConfig, aim: Vec3, charge: number): void {
    if (this.state.projectiles.size >= MAX_PROJECTILES) return;
    const kind = weapon.projectile ?? 'arrow';
    const speed = (weapon.projectileSpeed ?? 30) * (weapon.charge ? 0.5 + charge * 0.5 : 1);

    const proj = new ProjectileState();
    this.seq += 1;
    proj.id = `p${this.seq}`;
    proj.kind = kind;
    proj.ownerId = player.id;
    proj.weapon = weapon.id;
    proj.x = player.x + aim.x * 0.7;
    proj.y = player.y + EYE_OFFSET + aim.y * 0.7;
    proj.z = player.z + aim.z * 0.7;
    proj.vx = aim.x * speed;
    proj.vy = aim.y * speed + (weapon.category === 'thrown' ? 3 : 0.5);
    proj.vz = aim.z * speed;

    this.state.projectiles.set(proj.id, proj);
    this.projMeta.set(proj.id, {
      bornAt: Date.now(),
      explodeAt: weapon.fuseMs ? Date.now() + weapon.fuseMs : 0,
      charge,
    });
  }

  private updateProjectiles(dt: number, now: number): void {
    this.state.projectiles.forEach((proj) => {
      const meta = this.projMeta.get(proj.id);
      if (!meta) {
        this.removeProjectile(proj.id);
        return;
      }
      const weapon = getWeapon(proj.weapon);
      const heavy = proj.kind === 'grenade' || proj.kind === 'firebomb';
      const g = heavy ? PROJECTILE_GRAVITY : ARROW_GRAVITY;

      proj.vy -= g * dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.z += proj.vz * dt;

      // Player collision (ignore owner briefly).
      let hit: PlayerState | null = null;
      this.state.players.forEach((victim) => {
        if (hit || !victim.alive) return;
        if (victim.id === proj.ownerId && now - meta.bornAt < 160) return;
        const d = Math.hypot(victim.x - proj.x, victim.y + 0.3 - proj.y, victim.z - proj.z);
        if (d <= PROJECTILE_HIT_RADIUS + PLAYER_RADIUS) hit = victim;
      });

      const onGround = proj.y <= 0.15;
      const outside = Math.hypot(proj.x, proj.z) > ARENA_RADIUS + 0.5;
      const expired = now - meta.bornAt > PROJECTILE_LIFETIME_MS;

      if (proj.kind === 'grenade') {
        if (onGround) {
          proj.y = 0.2;
          proj.vy = 0;
          proj.vx *= 0.6;
          proj.vz *= 0.6;
        }
        if (hit || (meta.explodeAt && now >= meta.explodeAt) || expired) {
          this.explode(proj, weapon, false);
          this.removeProjectile(proj.id);
        }
        return;
      }

      if (proj.kind === 'firebomb') {
        if (hit || onGround || outside || expired) {
          this.explode(proj, weapon, true);
          this.removeProjectile(proj.id);
        }
        return;
      }

      // Arrows / bolts / knives.
      if (hit) {
        const dmg = weapon.damage * (weapon.charge ? 0.4 + meta.charge * 0.6 : 1);
        this.applyDamage(proj.ownerId, hit, weapon, proj.x, proj.z, dmg, weapon.knockback);
        this.removeProjectile(proj.id);
      } else if (onGround || outside || expired) {
        this.removeProjectile(proj.id);
      }
    });
  }

  private removeProjectile(id: string): void {
    this.state.projectiles.delete(id);
    this.projMeta.delete(id);
  }

  // -------------------------------------------------------------------------
  // Explosions + hazards (fire areas) + placed traps
  // -------------------------------------------------------------------------

  private explode(at: { x: number; y: number; z: number }, weapon: WeaponConfig, fire: boolean): void {
    const radius = weapon.aoeRadius ?? 3;
    this.broadcast('explosion', { x: at.x, y: at.y, z: at.z, radius, fire });

    this.state.players.forEach((victim) => {
      if (!victim.alive) return;
      const d = Math.hypot(victim.x - at.x, victim.z - at.z);
      if (d > radius) return;
      const falloff = 1 - d / radius;
      const dmg = weapon.damage * (0.4 + 0.6 * falloff);
      this.applyDamage('', victim, weapon, at.x, at.z, dmg, weapon.knockback * falloff, true);
    });

    if (fire && weapon.dotPerSec && this.state.hazards.size < MAX_HAZARDS) {
      this.spawnHazard('fire', at.x, at.z, radius, weapon, Date.now() + (weapon.hazardMs ?? 4000), 0);
    }
  }

  private placeTrap(player: PlayerState, weapon: WeaponConfig, now: number): void {
    if (this.state.hazards.size >= MAX_HAZARDS) return;
    const kind = weapon.projectile === 'spike' ? 'spike' : 'mine';
    this.spawnHazard(kind, player.x, player.z, weapon.aoeRadius ?? 2, weapon, now + TRAP_LIFETIME_MS, now + 900, player.id, true);
  }

  private spawnHazard(
    kind: 'fire' | 'spike' | 'mine',
    x: number,
    z: number,
    radius: number,
    weapon: WeaponConfig,
    expireAt: number,
    armUntil: number,
    ownerId = '',
    armed = false,
  ): void {
    const hz = new HazardState();
    this.seq += 1;
    hz.id = `h${this.seq}`;
    hz.kind = kind;
    hz.ownerId = ownerId;
    hz.x = x;
    hz.y = 0.05;
    hz.z = z;
    hz.radius = radius;
    hz.armed = armed;
    this.state.hazards.set(hz.id, hz);
    this.hazardMeta.set(hz.id, {
      expireAt,
      armUntil,
      dotPerSec: weapon.dotPerSec ?? 0,
      weapon: weapon.id,
    });
  }

  private updateHazards(dt: number, now: number): void {
    this.state.hazards.forEach((hz) => {
      const meta = this.hazardMeta.get(hz.id);
      if (!meta) {
        this.removeHazard(hz.id);
        return;
      }
      const weapon = getWeapon(meta.weapon);

      if (hz.armed) {
        // Armed mine / spike trap — trigger on proximity.
        let triggered = false;
        this.state.players.forEach((p) => {
          if (triggered || !p.alive) return;
          if (p.id === hz.ownerId && now < meta.armUntil) return;
          if (Math.hypot(p.x - hz.x, p.z - hz.z) <= TRAP_TRIGGER_RADIUS) triggered = true;
        });
        if (triggered) {
          if (hz.kind === 'mine') {
            this.explode({ x: hz.x, y: 0.3, z: hz.z }, weapon, false);
            this.removeHazard(hz.id);
          } else {
            // Spike trap springs into a lingering damage field.
            hz.armed = false;
            meta.expireAt = now + (weapon.hazardMs ?? 5000);
            this.broadcast('explosion', { x: hz.x, y: 0.2, z: hz.z, radius: hz.radius, fire: false });
          }
        }
        if (now > meta.expireAt) this.removeHazard(hz.id);
        return;
      }

      // Active damage-over-time field (fire / sprung spikes).
      this.state.players.forEach((p) => {
        if (!p.alive) return;
        if (Math.hypot(p.x - hz.x, p.z - hz.z) <= hz.radius) {
          p.hp = Math.max(0, p.hp - meta.dotPerSec * dt);
          p.lastHitAt = now;
          if (p.hp <= 0) this.killPlayer(p);
        }
      });
      if (now > meta.expireAt) this.removeHazard(hz.id);
    });
  }

  private removeHazard(id: string): void {
    this.state.hazards.delete(id);
    this.hazardMeta.delete(id);
  }

  // -------------------------------------------------------------------------
  // Damage / blocking
  // -------------------------------------------------------------------------

  private applyDamage(
    attackerId: string,
    victim: PlayerState,
    weapon: WeaponConfig,
    fromX: number,
    fromZ: number,
    baseDamage: number,
    baseKnockback: number,
    isExplosion = false,
  ): void {
    const victimWeapon = getWeapon(victim.weapon);
    let blocked = false;
    if (victim.blocking && this.isFrontBlock(victim, fromX, fromZ)) {
      blocked = true;
    }
    const reduction = blocked ? victimWeapon.blockReduction * (isExplosion ? 0.6 : 1) : 0;
    const damage = baseDamage * (1 - reduction);

    victim.hp = Math.max(0, victim.hp - damage);
    victim.lastHitAt = Date.now();

    const knockMag = effectiveKnockback(baseKnockback * (1 - reduction), victim.hp);
    const t = this.transients.get(victim.id);
    if (t) applyKnockback(victim, t, knockMag, fromX, fromZ);

    this.broadcast('hit', {
      attackerId,
      victimId: victim.id,
      damage,
      weapon: weapon.id,
      blocked,
    });

    if (victim.hp <= 0) this.killPlayer(victim);
  }

  private isFrontBlock(victim: PlayerState, fromX: number, fromZ: number): boolean {
    let dx = fromX - victim.x;
    let dz = fromZ - victim.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const f = yawForward(victim.yaw);
    return dx * f.x + dz * f.z >= BLOCK_FRONT_DOT;
  }

  private killPlayer(player: PlayerState): void {
    player.alive = false;
    player.hp = 0;
    player.blocking = false;
    player.dashing = false;
    player.charging = false;
  }

  // -------------------------------------------------------------------------
  // Weapon uses
  // -------------------------------------------------------------------------

  private consumeUse(player: PlayerState): void {
    const weapon = getWeapon(player.weapon);
    if (!Number.isFinite(weapon.uses)) return;
    player.weaponUses -= 1;
    if (player.weaponUses <= 0) {
      player.weapon = DEFAULT_WEAPON;
      player.weaponUses = 0;
      player.charging = false;
    }
  }

  // -------------------------------------------------------------------------
  // Crates
  // -------------------------------------------------------------------------

  private updateCrates(now: number): void {
    if (now >= this.nextCrateAt && this.state.hazards.size + this.state.crates.size < MAX_CRATES + MAX_HAZARDS && this.state.crates.size < MAX_CRATES) {
      this.spawnCrate();
      this.nextCrateAt = now + this.randomCrateDelay();
    }

    const pickupDist = PLAYER_RADIUS + CRATE_SIZE * 0.8;
    this.state.crates.forEach((crate) => {
      this.state.players.forEach((player) => {
        if (!player.alive) return;
        const dist = Math.hypot(player.x - crate.x, player.y - crate.y, player.z - crate.z);
        if (dist <= pickupDist) {
          const weapon = getWeapon(crate.weapon);
          player.weapon = crate.weapon;
          player.weaponUses = Number.isFinite(weapon.uses) ? weapon.uses : 0;
          player.charging = false;
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
    this.seq += 1;
    crate.id = `crate:${pointIndex}:${this.seq}`;
    crate.x = point.x;
    crate.y = point.y;
    crate.z = point.z;
    crate.weapon = rollCrateWeapon();
    this.state.crates.set(crate.id, crate);
  }

  private randomCrateDelay(): number {
    return CRATE_SPAWN_MIN_MS + Math.random() * (CRATE_SPAWN_MAX_MS - CRATE_SPAWN_MIN_MS);
  }

  // -------------------------------------------------------------------------
  // RoundHost
  // -------------------------------------------------------------------------

  respawnAll(): void {
    let index = 0;
    this.state.players.forEach((player) => {
      this.placeAtSpawn(player, index);
      player.hp = MAX_HP;
      player.alive = true;
      player.weapon = DEFAULT_WEAPON;
      player.weaponUses = 0;
      player.blocking = false;
      player.dashing = false;
      player.charging = false;
      player.lastAttackAt = 0;
      player.lastHitAt = 0;
      const t = this.transients.get(player.id);
      if (t) {
        t.grounded = false;
        t.jumps = 0;
        t.stun = 0;
        t.lastDashAt = 0;
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

  clearEntities(): void {
    this.state.projectiles.clear();
    this.state.hazards.clear();
    this.projMeta.clear();
    this.hazardMeta.clear();
    this.pendingSwings = [];
  }

  private placeAtSpawn(player: PlayerState, index: number): void {
    const point = SPAWN_POINTS[index % SPAWN_POINTS.length] ?? { x: 0, y: 2, z: 0 };
    player.x = point.x;
    player.y = point.y;
    player.z = point.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    // Face the center of the arena.
    player.yaw = Math.atan2(-point.x, point.z);
  }
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function normalize3(x: number, y: number, z: number): Vec3 {
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
