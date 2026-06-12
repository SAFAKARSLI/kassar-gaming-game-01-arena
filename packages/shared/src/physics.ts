/**
 * Deterministic arcade kinematics shared by the server simulation and the
 * client prediction layer. Keeping the math in one place means the client's
 * predicted local player and the server's authority agree, minimizing
 * reconciliation corrections.
 *
 * NOTE: We intentionally use a small custom kinematic solver rather than a full
 * rigid-body engine on the server. It is deterministic, cheap to run headless
 * in Node, trivial to predict on the client, and gives the snappy "platform
 * fighter" feel this game needs. The code is structured so a heavier solver
 * (or rollback) could replace `stepKinematics` later without touching callers.
 */

import {
  AIR_CONTROL,
  AIR_DRAG,
  BLOCK_MOVE_MULTIPLIER,
  DASH_COOLDOWN_MS,
  DASH_IMPULSE,
  GRAVITY,
  GROUND_CONTROL,
  HIT_STUN,
  JUMP_VELOCITY,
  MAX_HP,
  MAX_JUMPS,
  MOVE_SPEED,
  PLAYER_HALF_HEIGHT,
  PLAYER_RADIUS,
} from './constants';
import { PLATFORMS, COVER_PILLARS, ARENA_RADIUS } from './arena';
import type { InputMessage } from './types';

/** Minimal mutable transform + velocity. PlayerState matches this structurally. */
export interface KinematicBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
}

/** Server/client-side transient state that is NOT replicated. */
export interface KinematicTransient {
  grounded: boolean;
  jumps: number;
  /** Remaining hit-stun in seconds (input control disabled while > 0). */
  stun: number;
  /** Timestamp (ms) of last dash, for cooldown. */
  lastDashAt: number;
  dashing: boolean;
}

export function createTransient(): KinematicTransient {
  return { grounded: false, jumps: 0, stun: 0, lastDashAt: 0, dashing: false };
}

/**
 * Advance one body by `dt` seconds given the current input. Mutates both the
 * body and its transient state in place.
 */
export function stepKinematics(
  body: KinematicBody,
  t: KinematicTransient,
  input: InputMessage,
  dt: number,
  now: number,
): void {
  body.facing = input.facing >= 0 ? 1 : -1;
  t.dashing = false;

  // --- horizontal control (disabled during hit-stun so knockback flies) ---
  const speed = input.block ? MOVE_SPEED * BLOCK_MOVE_MULTIPLIER : MOVE_SPEED;
  if (t.stun <= 0) {
    const control = t.grounded ? GROUND_CONTROL : AIR_CONTROL;
    const k = Math.min(1, control * dt);
    body.vx += (input.moveX * speed - body.vx) * k;
    body.vz += (input.moveZ * speed - body.vz) * k;
  } else {
    t.stun -= dt;
    const d = Math.max(0, 1 - AIR_DRAG * dt);
    body.vx *= d;
    body.vz *= d;
  }

  // --- jump (edge-triggered by the caller / input layer) ---
  if (input.jump && t.jumps < MAX_JUMPS) {
    body.vy = JUMP_VELOCITY;
    t.jumps += 1;
    t.grounded = false;
  }

  // --- dash ---
  if (input.dash && now - t.lastDashAt >= DASH_COOLDOWN_MS) {
    body.vx = body.facing * DASH_IMPULSE;
    body.vy = Math.max(body.vy, 1.5);
    t.lastDashAt = now;
    t.dashing = true;
  }

  // --- gravity + integrate ---
  body.vy -= GRAVITY * dt;
  const prevFeet = body.y - PLAYER_HALF_HEIGHT;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.z += body.vz * dt;

  // --- one-way platform collision (land on top while descending) ---
  t.grounded = false;
  for (const p of PLATFORMS) {
    const top = p.cy + p.hy;
    const withinX = body.x > p.cx - p.hx - PLAYER_RADIUS && body.x < p.cx + p.hx + PLAYER_RADIUS;
    const withinZ = body.z > p.cz - p.hz - PLAYER_RADIUS && body.z < p.cz + p.hz + PLAYER_RADIUS;
    if (!withinX || !withinZ) continue;
    const feet = body.y - PLAYER_HALF_HEIGHT;
    if (body.vy <= 0 && feet <= top && prevFeet >= top - 0.05) {
      body.y = top + PLAYER_HALF_HEIGHT;
      body.vy = 0;
      t.grounded = true;
    }
  }

  if (t.grounded) {
    t.jumps = 0;
  }

  // --- arena containment: keep fighters inside the circular pit (no ring-outs) ---
  const maxR = ARENA_RADIUS - PLAYER_RADIUS;
  const r = Math.hypot(body.x, body.z);
  if (r > maxR) {
    const nx = body.x / r;
    const nz = body.z / r;
    body.x = nx * maxR;
    body.z = nz * maxR;
    // Cancel the outward component of velocity so knockback "slams" into the wall.
    const vOut = body.vx * nx + body.vz * nz;
    if (vOut > 0) {
      body.vx -= vOut * nx;
      body.vz -= vOut * nz;
    }
  }

  // --- cover pillar collision (solid circular columns) ---
  for (const p of COVER_PILLARS) {
    const dx = body.x - p.x;
    const dz = body.z - p.z;
    const d = Math.hypot(dx, dz);
    const min = p.radius + PLAYER_RADIUS;
    if (d > 0.0001 && d < min) {
      const nx = dx / d;
      const nz = dz / d;
      body.x = p.x + nx * min;
      body.z = p.z + nz * min;
      const vIn = body.vx * nx + body.vz * nz;
      if (vIn < 0) {
        body.vx -= vIn * nx;
        body.vz -= vIn * nz;
      }
    }
  }
}

/** Knockback grows as the victim's accumulated damage rises (comeback mechanic). */
export function effectiveKnockback(baseKnockback: number, victimHp: number): number {
  const damageTakenPercent = (MAX_HP - victimHp) / MAX_HP; // 0 at full hp, 1 at 0 hp
  return baseKnockback * (1 + damageTakenPercent);
}

/** Apply a knockback impulse to a victim, sending them away from `fromX`/`fromZ`. */
export function applyKnockback(
  body: KinematicBody,
  t: KinematicTransient,
  magnitude: number,
  fromX: number,
  fromZ: number,
): void {
  let dx = body.x - fromX;
  let dz = body.z - fromZ;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) {
    dx = body.facing;
    dz = 0;
  } else {
    dx /= len;
    dz /= len;
  }
  body.vx += dx * magnitude;
  body.vz += dz * magnitude * 0.4;
  body.vy += magnitude * 0.55 + 2; // pop up so victims sail off the edge
  t.stun = HIT_STUN;
  t.grounded = false;
}
