/**
 * Central weapon configuration — the single source of truth for every weapon's
 * combat stats, category and rarity. Server and client both read this.
 *
 * Categories:
 *  - melee:  forward arc/sphere sweep (sword, axe, spear, ...)
 *  - ranged: fires a projectile; `charge` weapons draw on hold (bow)
 *  - thrown: lobbed projectile with a physics arc (knives, grenade, fire bomb)
 *  - placed: dropped on the ground and armed (land mine, spike trap)
 */

export type WeaponId =
  | 'fists'
  | 'dagger'
  | 'sword'
  | 'axe'
  | 'mace'
  | 'spear'
  | 'warhammer'
  | 'halberd'
  | 'shieldsword'
  | 'bow'
  | 'crossbow'
  | 'throwingknives'
  | 'grenade'
  | 'firebomb'
  | 'landmine'
  | 'spiketrap'
  | 'excalibur';

export type WeaponCategory = 'melee' | 'ranged' | 'thrown' | 'placed';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ProjectileKind = 'arrow' | 'bolt' | 'knife' | 'grenade' | 'firebomb' | 'mine' | 'spike';

export interface WeaponConfig {
  readonly id: WeaponId;
  readonly name: string;
  readonly category: WeaponCategory;
  readonly rarity: Rarity;
  /** Base hit-point damage (per hit / per projectile / explosion center). */
  readonly damage: number;
  /** Melee reach, or projectile spawn offset for ranged/thrown. */
  readonly range: number;
  /** Base knockback impulse. */
  readonly knockback: number;
  /** Cooldown between uses in ms (also draw-min / reload for ranged). */
  readonly cooldownMs: number;
  /** Display color of the held weapon / pickup. */
  readonly color: string;

  // --- melee ---
  /** Half-angle (radians) of the forward swing arc. */
  readonly arc?: number;
  /** Windup / swing / recovery timing (ms) for animation + when the hit lands. */
  readonly windupMs?: number;

  // --- ranged / thrown ---
  readonly projectile?: ProjectileKind;
  /** Launch speed of the projectile (units/s). */
  readonly projectileSpeed?: number;
  /** Whether holding charges the shot (bow). */
  readonly charge?: boolean;
  /** Max draw time in ms for full-charge weapons. */
  readonly maxDrawMs?: number;

  // --- explosive / hazard ---
  /** Fuse before a thrown explosive detonates (ms); fire bombs detonate on impact. */
  readonly fuseMs?: number;
  /** Area-of-effect radius for explosions / hazards. */
  readonly aoeRadius?: number;
  /** Lingering damage-over-time per second (fire bomb / spike trap). */
  readonly dotPerSec?: number;
  /** Lifetime of a lingering hazard (ms). */
  readonly hazardMs?: number;

  /** Block damage/knockback reduction (0..1) while this weapon is raised. */
  readonly blockReduction: number;
  /** How many uses before reverting to the default weapon (Infinity = melee). */
  readonly uses: number;
}

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  fists: {
    id: 'fists', name: 'Fists', category: 'melee', rarity: 'common',
    damage: 5, range: 1.4, knockback: 2, cooldownMs: 320, arc: 0.7, windupMs: 80,
    color: '#d9b38c', blockReduction: 0.4, uses: Infinity,
  },
  dagger: {
    id: 'dagger', name: 'Dagger', category: 'melee', rarity: 'common',
    damage: 9, range: 1.7, knockback: 3, cooldownMs: 300, arc: 0.5, windupMs: 70,
    color: '#cbd5e1', blockReduction: 0.45, uses: Infinity,
  },
  sword: {
    id: 'sword', name: 'Sword', category: 'melee', rarity: 'common',
    damage: 14, range: 2.3, knockback: 6, cooldownMs: 520, arc: 0.75, windupMs: 130,
    color: '#e2e8f0', blockReduction: 0.6, uses: Infinity,
  },
  axe: {
    id: 'axe', name: 'Axe', category: 'melee', rarity: 'uncommon',
    damage: 24, range: 2.4, knockback: 9, cooldownMs: 880, arc: 0.6, windupMs: 240,
    color: '#f59e0b', blockReduction: 0.55, uses: Infinity,
  },
  mace: {
    id: 'mace', name: 'Mace', category: 'melee', rarity: 'uncommon',
    damage: 20, range: 2.2, knockback: 15, cooldownMs: 1000, arc: 0.6, windupMs: 260,
    color: '#a855f7', blockReduction: 0.55, uses: Infinity,
  },
  spear: {
    id: 'spear', name: 'Spear', category: 'melee', rarity: 'uncommon',
    damage: 18, range: 3.6, knockback: 8, cooldownMs: 700, arc: 0.32, windupMs: 180,
    color: '#94a3b8', blockReduction: 0.5, uses: Infinity,
  },
  warhammer: {
    id: 'warhammer', name: 'War Hammer', category: 'melee', rarity: 'rare',
    damage: 34, range: 2.4, knockback: 22, cooldownMs: 1250, arc: 0.55, windupMs: 340,
    color: '#7c3aed', blockReduction: 0.5, uses: Infinity,
  },
  halberd: {
    id: 'halberd', name: 'Halberd', category: 'melee', rarity: 'rare',
    damage: 28, range: 3.4, knockback: 12, cooldownMs: 950, arc: 0.7, windupMs: 280,
    color: '#b45309', blockReduction: 0.55, uses: Infinity,
  },
  shieldsword: {
    id: 'shieldsword', name: 'Sword & Shield', category: 'melee', rarity: 'rare',
    damage: 13, range: 2.2, knockback: 6, cooldownMs: 560, arc: 0.7, windupMs: 130,
    color: '#38bdf8', blockReduction: 0.85, uses: Infinity,
  },
  bow: {
    id: 'bow', name: 'Bow', category: 'ranged', rarity: 'rare',
    damage: 38, range: 0.8, knockback: 7, cooldownMs: 250,
    projectile: 'arrow', projectileSpeed: 42, charge: true, maxDrawMs: 900,
    color: '#a16207', blockReduction: 0.3, uses: 14,
  },
  crossbow: {
    id: 'crossbow', name: 'Crossbow', category: 'ranged', rarity: 'rare',
    damage: 46, range: 0.8, knockback: 9, cooldownMs: 1400,
    projectile: 'bolt', projectileSpeed: 64,
    color: '#854d0e', blockReduction: 0.3, uses: 8,
  },
  throwingknives: {
    id: 'throwingknives', name: 'Throwing Knives', category: 'thrown', rarity: 'uncommon',
    damage: 16, range: 0.7, knockback: 4, cooldownMs: 360,
    projectile: 'knife', projectileSpeed: 34,
    color: '#cbd5e1', blockReduction: 0.3, uses: 10,
  },
  grenade: {
    id: 'grenade', name: 'Grenade', category: 'thrown', rarity: 'epic',
    damage: 44, range: 0.6, knockback: 26, cooldownMs: 700,
    projectile: 'grenade', projectileSpeed: 18, fuseMs: 1400, aoeRadius: 4.2,
    color: '#3f6212', blockReduction: 0.3, uses: 2,
  },
  firebomb: {
    id: 'firebomb', name: 'Fire Bomb', category: 'thrown', rarity: 'epic',
    damage: 20, range: 0.6, knockback: 8, cooldownMs: 750,
    projectile: 'firebomb', projectileSpeed: 17, aoeRadius: 3.4,
    dotPerSec: 14, hazardMs: 5000,
    color: '#ea580c', blockReduction: 0.3, uses: 2,
  },
  landmine: {
    id: 'landmine', name: 'Land Mine', category: 'placed', rarity: 'epic',
    damage: 48, range: 0.5, knockback: 28, cooldownMs: 600,
    projectile: 'mine', aoeRadius: 3.6,
    color: '#374151', blockReduction: 0.3, uses: 2,
  },
  spiketrap: {
    id: 'spiketrap', name: 'Spike Trap', category: 'placed', rarity: 'epic',
    damage: 16, range: 0.5, knockback: 4, cooldownMs: 600,
    projectile: 'spike', aoeRadius: 1.8, dotPerSec: 18, hazardMs: 6000,
    color: '#6b7280', blockReduction: 0.3, uses: 2,
  },
  excalibur: {
    id: 'excalibur', name: 'Excalibur', category: 'melee', rarity: 'legendary',
    damage: 30, range: 2.7, knockback: 14, cooldownMs: 480, arc: 0.85, windupMs: 110,
    color: '#fde68a', blockReduction: 0.75, uses: Infinity,
  },
};

/** Every player starts a round holding this weapon. */
export const DEFAULT_WEAPON: WeaponId = 'sword';

/** Spawn weight by rarity — higher = more common in crates. */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 16,
  epic: 7,
  legendary: 2,
};

/** Weapons that can drop from crates (everything except fists / the starter is fine to roll). */
export const CRATE_WEAPONS: readonly WeaponId[] = [
  'dagger', 'sword', 'axe', 'mace', 'spear', 'warhammer', 'halberd', 'shieldsword',
  'bow', 'crossbow', 'throwingknives', 'grenade', 'firebomb', 'landmine', 'spiketrap',
  'excalibur',
];

export function getWeapon(id: string): WeaponConfig {
  return WEAPONS[id as WeaponId] ?? WEAPONS[DEFAULT_WEAPON];
}

/** Weighted-random crate roll using rarity weights. */
export function rollCrateWeapon(): WeaponId {
  let total = 0;
  for (const id of CRATE_WEAPONS) total += RARITY_WEIGHT[WEAPONS[id].rarity];
  let r = Math.random() * total;
  for (const id of CRATE_WEAPONS) {
    r -= RARITY_WEIGHT[WEAPONS[id].rarity];
    if (r <= 0) return id;
  }
  return DEFAULT_WEAPON;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#cbd5e1',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};
