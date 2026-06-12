/**
 * Colyseus state schema — the authoritative game state replicated to clients.
 * Shared by server (mutates) and client (reads). Requires `experimentalDecorators`.
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
  @type('number') vx = 0;
  @type('number') vy = 0;
  @type('number') vz = 0;

  /** Look yaw (radians) — drives body orientation, melee arcs, dash. */
  @type('number') yaw = 0;

  // Combat / status
  @type('number') hp = MAX_HP;
  @type('boolean') alive = true;
  @type('number') score = 0;
  @type('string') weapon = DEFAULT_WEAPON;
  /** Remaining uses for limited weapons (ranged/thrown/placed). */
  @type('number') weaponUses = 0;
  @type('boolean') blocking = false;
  @type('boolean') charging = false;

  // Animation / feedback (server-time ms timestamps)
  @type('number') lastAttackAt = 0;
  @type('number') lastHitAt = 0;
  /** Which attack animation to play (0 slash-L, 1 slash-R, 2 overhead/stab). */
  @type('number') swingType = 0;
  @type('boolean') dashing = false;
  @type('boolean') connected = true;
}

export class ProjectileState extends Schema {
  @type('string') id = '';
  /** arrow | bolt | knife | grenade | firebomb | mine | spike */
  @type('string') kind = 'arrow';
  @type('string') ownerId = '';
  @type('string') weapon = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') vx = 0;
  @type('number') vy = 0;
  @type('number') vz = 0;
}

export class CrateState extends Schema {
  @type('string') id = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  /** Weapon id rolled for this crate. */
  @type('string') weapon = DEFAULT_WEAPON;
}

export class HazardState extends Schema {
  @type('string') id = '';
  /** fire | spike | mine */
  @type('string') kind = 'fire';
  @type('string') ownerId = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') radius = 2;
  /** True for armed mines/spikes waiting to trigger. */
  @type('boolean') armed = false;
}

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: CrateState }) crates = new MapSchema<CrateState>();
  @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
  @type({ map: HazardState }) hazards = new MapSchema<HazardState>();

  @type('string') roundState: string = RoundState.Waiting;
  @type('string') roundWinnerId = '';
  @type('string') matchWinnerId = '';
  @type('string') message = 'Waiting for players...';
  @type('number') countdown = 0;
  @type('string') code = '';
}
