/**
 * Shared message types and enums exchanged between client and server.
 */

/** High-level round/match flow states (stored on the schema as a string). */
export enum RoundState {
  Waiting = 'waiting',
  Countdown = 'countdown',
  Playing = 'playing',
  RoundEnd = 'roundEnd',
  MatchEnd = 'matchEnd',
}

/**
 * Per-frame input (message "input"). Movement is sent in **world space** (the
 * client converts WASD into a world vector using the look yaw), so the server
 * physics stays simple and identical to the client prediction. The look
 * direction (`yaw` + normalized `aim`) drives facing, melee arcs and projectile
 * launches.
 */
export interface InputMessage {
  seq: number;
  /** World-space desired horizontal movement, each in -1..1. */
  moveX: number;
  moveZ: number;
  /** Look yaw (radians) — also used to orient the body. */
  yaw: number;
  /** Normalized world-space look/aim direction. */
  aimX: number;
  aimY: number;
  aimZ: number;
  jump: boolean;
  dash: boolean;
  /** Right mouse held — raising the weapon/shield to block. */
  block: boolean;
}

/** Client → server: begin using the equipped weapon (LMB down). */
export interface UseStartMessage {
  yaw: number;
  aimX: number;
  aimY: number;
  aimZ: number;
}

/** Client → server: release the weapon (LMB up) — fires a charged bow, etc. */
export interface UseEndMessage {
  aimX: number;
  aimY: number;
  aimZ: number;
}

/** Server → client: a melee hit landed (message "hit"). */
export interface HitEvent {
  attackerId: string;
  victimId: string;
  damage: number;
  weapon: string;
  blocked: boolean;
}

/** Server → client: an explosion happened (message "explosion") for VFX. */
export interface ExplosionEvent {
  x: number;
  y: number;
  z: number;
  radius: number;
  fire: boolean;
}

/** Client → server when entering a room (join options). */
export interface JoinOptions {
  name: string;
  code: string;
}

export const EMPTY_INPUT: InputMessage = {
  seq: 0,
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  aimX: 0,
  aimY: 0,
  aimZ: -1,
  jump: false,
  dash: false,
  block: false,
};
