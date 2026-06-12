/**
 * Colyseus state schema — the authoritative game state replicated to clients.
 *
 * These classes are shared by the server (which mutates them) and the client
 * (which reads them, fully typed). Requires `experimentalDecorators`.
 */

import { Schema, MapSchema, type } from '@colyseus/schema';
import { MAX_HP } from './constants';
import { DEFAULT_WEAPON } from './weapons';
import { RoundState } from './types';

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') colorIndex = 0;

  // Transform
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;

  // Velocity (replicated so clients can smooth / predict)
  @type('number') vx = 0;
  @type('number') vy = 0;
  @type('number') vz = 0;

  // Combat / status
  @type('number') hp = MAX_HP;
  @type('boolean') alive = true;
  @type('number') score = 0;
  @type('string') weapon = DEFAULT_WEAPON;
  @type('number') facing = 1;
  @type('boolean') blocking = false;

  // Animation / feedback flags (timestamps in server ms)
  @type('number') lastAttackAt = 0;
  @type('number') lastHitAt = 0;
  @type('boolean') dashing = false;

  // True once the player has connected and is in the room.
  @type('boolean') connected = true;
}

export class CrateState extends Schema {
  @type('string') id = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('string') weapon = DEFAULT_WEAPON;
}

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: CrateState }) crates = new MapSchema<CrateState>();

  /** One of RoundState values. */
  @type('string') roundState: string = RoundState.Waiting;

  /** Session id of the player who won the most recent round (or ''). */
  @type('string') roundWinnerId = '';
  /** Session id of the match winner (or ''). */
  @type('string') matchWinnerId = '';

  /** Banner message shown on all clients. */
  @type('string') message = 'Waiting for players...';

  /** Countdown seconds remaining (when in Countdown / RoundEnd states). */
  @type('number') countdown = 0;

  /** 6-char room code (shareable). */
  @type('string') code = '';
}
