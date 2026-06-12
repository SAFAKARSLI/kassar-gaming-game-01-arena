/**
 * Single source of truth for all weapon definitions.
 *
 * Damage, knockback, attack speed and range are all configurable here.
 */

export type WeaponId = 'dagger' | 'sword' | 'axe' | 'mace';

export interface WeaponConfig {
  readonly id: WeaponId;
  readonly name: string;
  /** Hit-point damage per successful hit. */
  readonly damage: number;
  /** Base knockback impulse magnitude (scaled up by the victim's damage %). */
  readonly knockback: number;
  /** Cooldown between attacks in milliseconds (lower = faster). */
  readonly attackSpeedMs: number;
  /** Maximum reach of the melee swing (world units). */
  readonly range: number;
  /** Display color for the held weapon mesh. */
  readonly color: string;
}

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  dagger: {
    id: 'dagger',
    name: 'Dagger',
    damage: 6,
    knockback: 3,
    attackSpeedMs: 300,
    range: 1.6,
    color: '#cbd5e1',
  },
  sword: {
    id: 'sword',
    name: 'Sword',
    damage: 12,
    knockback: 6,
    attackSpeedMs: 520,
    range: 2.2,
    color: '#e2e8f0',
  },
  axe: {
    id: 'axe',
    name: 'Axe',
    damage: 22,
    knockback: 9,
    attackSpeedMs: 900,
    range: 2.5,
    color: '#f59e0b',
  },
  mace: {
    id: 'mace',
    name: 'Mace',
    damage: 16,
    knockback: 15,
    attackSpeedMs: 1200,
    range: 2.3,
    color: '#a855f7',
  },
};

/** Every player starts a round holding this weapon. */
export const DEFAULT_WEAPON: WeaponId = 'sword';

/** Weapons that can drop from crates (all of them, default included). */
export const CRATE_WEAPONS: readonly WeaponId[] = ['dagger', 'sword', 'axe', 'mace'];

export function getWeapon(id: string): WeaponConfig {
  const weapon = WEAPONS[id as WeaponId];
  return weapon ?? WEAPONS[DEFAULT_WEAPON];
}

export function randomCrateWeapon(): WeaponId {
  const index = Math.floor(Math.random() * CRATE_WEAPONS.length);
  return CRATE_WEAPONS[index] ?? DEFAULT_WEAPON;
}
