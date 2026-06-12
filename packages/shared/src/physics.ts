/**
 * Deterministic arcade kinematics shared by the server simulation and the
 * client prediction layer. Movement arrives in world space (the client builds it
 * from WASD + look yaw), so the solver itself is view-agnostic. Dash follows the
 * aim direction. Structured behind `stepKinematics` so a heavier solver/rollback
 * could replace it later.
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

/** Horizontal forward unit vector for a yaw. yaw=0 looks toward -Z. */
export function yawForward(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Minimal mutable transform + velocity. PlayerState matches this structurally. */
export interface KinematicBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
}

/** Server/client-side transient state that is NOT replicated. */
export interface KinematicTransient {
  grounded: boolean;
  jumps: number;
  stun: number;
  lastDashAt: number;
  dashing: boolean;
  /** Set on the tick the body lands; consumed by the client for a camera bounce. */
  justLanded: boolean;
  /** Downward speed at the moment of landing (negative). */
  landSpeed: number;
}

export function createTransient(): KinematicTransient {
  return {
    grounded: false,
    jumps: 0,
    stun: 0,
    lastDashAt: 0,
    dashing: false,
    justLanded: false,
    landSpeed: 0,
  };
}

export function stepKinematics(
  body: KinematicBody,
  t: KinematicTransient,
  input: InputMessage,
  dt: number,
  now: number,
): void {
  body.yaw = input.yaw;
  t.dashing = false;
  t.justLanded = false;
  const wasGrounded = t.grounded;

  // --- horizontal control (world-space move; disabled during hit-stun) ---
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

  // --- jump ---
  if (input.jump && t.jumps < MAX_JUMPS) {
    body.vy = JUMP_VELOCITY;
    t.jumps += 1;
    t.grounded = false;
  }

  // --- dash (follows aim direction) ---
  if (input.dash && now - t.lastDashAt >= DASH_COOLDOWN_MS) {
    let dx = input.aimX;
    let dz = input.aimZ;
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      dx /= len;
      dz /= len;
    } else {
      const f = yawForward(input.yaw);
      dx = f.x;
      dz = f.z;
    }
    body.vx = dx * DASH_IMPULSE;
    body.vz = dz * DASH_IMPULSE;
    body.vy = Math.max(body.vy, 1.5);
    t.lastDashAt = now;
    t.dashing = true;
  }

  // --- gravity + integrate ---
  body.vy -= GRAVITY * dt;
  const prevFeet = body.y - PLAYER_HALF_HEIGHT;
  const fallVy = body.vy;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.z += body.vz * dt;

  // --- one-way platform collision ---
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
    if (!wasGrounded) {
      t.justLanded = true;
      t.landSpeed = fallVy;
    }
  }

  // --- arena containment (circular pit, no ring-outs) ---
  const maxR = ARENA_RADIUS - PLAYER_RADIUS;
  const r = Math.hypot(body.x, body.z);
  if (r > maxR) {
    const nx = body.x / r;
    const nz = body.z / r;
    body.x = nx * maxR;
    body.z = nz * maxR;
    const vOut = body.vx * nx + body.vz * nz;
    if (vOut > 0) {
      body.vx -= vOut * nx;
      body.vz -= vOut * nz;
    }
  }

  // --- cover pillar collision ---
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
  const damageTakenPercent = (MAX_HP - victimHp) / MAX_HP;
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
    const f = yawForward(body.yaw);
    dx = -f.x;
    dz = -f.z;
  } else {
    dx /= len;
    dz /= len;
  }
  body.vx += dx * magnitude;
  body.vz += dz * magnitude * 0.4;
  body.vy += magnitude * 0.5 + 2;
  t.stun = HIT_STUN;
  t.grounded = false;
}
