/**
 * Shared message types and enums exchanged between client and server.
 * The Colyseus *state* lives in schema.ts; these are the one-off messages and
 * plain enums.
 */

/** High-level round/match flow states (stored on the schema as a string). */
export enum RoundState {
  /** Not enough players yet — waiting in the room. */
  Waiting = 'waiting',
  /** Countdown before a round starts. */
  Countdown = 'countdown',
  /** Active combat. */
  Playing = 'playing',
  /** A round just ended; showing the winner banner. */
  RoundEnd = 'roundEnd',
  /** A player reached the target score; match is over. */
  MatchEnd = 'matchEnd',
}

/** Per-frame input sent from client -> server (message name: "input"). */
export interface InputMessage {
  /** Monotonic sequence number for reconciliation. */
  seq: number;
  /** -1 (left) .. 1 (right) on the X axis. */
  moveX: number;
  /** -1 (toward camera) .. 1 (away) on the Z axis. */
  moveZ: number;
  /** Jump was pressed this frame (edge-triggered on the client). */
  jump: boolean;
  /** Dash was pressed this frame. */
  dash: boolean;
  /** Right mouse held — blocking. */
  block: boolean;
  /** Facing direction on X (-1 or 1) — used for attack / dash direction. */
  facing: number;
}

/** Client -> server: request an attack (message name: "attack"). Server validates. */
export interface AttackMessage {
  seq: number;
}

/** Server -> client: a transient combat event for VFX/feedback (message name: "hit"). */
export interface HitEvent {
  attackerId: string;
  victimId: string;
  damage: number;
  weapon: string;
}

/** Client -> server when entering a room (join options). */
export interface JoinOptions {
  name: string;
  /** 6-char room code used by filterBy matchmaking. */
  code: string;
}

export const EMPTY_INPUT: InputMessage = {
  seq: 0,
  moveX: 0,
  moveZ: 0,
  jump: false,
  dash: false,
  block: false,
  facing: 1,
};
