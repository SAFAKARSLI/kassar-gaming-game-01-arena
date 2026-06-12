/**
 * Arena geometry — shared so the server collides against the exact boxes the
 * client renders. A "floating platform" arena: one big main platform plus two
 * smaller platforms floating above it.
 *
 * Each platform is an axis-aligned box defined by its center and half-extents.
 * The camera looks down the -Z axis, so gameplay happens mostly on the X axis
 * with Y as vertical and a little Z depth.
 */

export interface Platform {
  /** Center position. */
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  /** Half-extents (half width/height/depth). */
  readonly hx: number;
  readonly hy: number;
  readonly hz: number;
  readonly color: string;
}

export const PLATFORMS: readonly Platform[] = [
  // Main central platform
  { cx: 0, cy: 0, cz: 0, hx: 11, hy: 0.5, hz: 3, color: '#475569' },
  // Upper-left floating platform
  { cx: -6, cy: 5, cz: 0, hx: 3, hy: 0.4, hz: 2.5, color: '#64748b' },
  // Upper-right floating platform
  { cx: 6, cy: 5, cz: 0, hx: 3, hy: 0.4, hz: 2.5, color: '#64748b' },
];

/** Spawn positions used when (re)spawning players at round start. */
export const SPAWN_POINTS: readonly { x: number; y: number; z: number }[] = [
  { x: -7, y: 2, z: 0 },
  { x: 0, y: 2, z: 0 },
  { x: 7, y: 2, z: 0 },
];

/** Predefined points where weapon crates can appear (sit just above a platform). */
export const CRATE_SPAWN_POINTS: readonly { x: number; y: number; z: number }[] = [
  { x: -6, y: 6, z: 0 },
  { x: 6, y: 6, z: 0 },
  { x: 0, y: 1.5, z: 0 },
  { x: -3, y: 1.5, z: 0 },
  { x: 3, y: 1.5, z: 0 },
];

export function spawnPoint(index: number): { x: number; y: number; z: number } {
  return SPAWN_POINTS[index % SPAWN_POINTS.length] ?? { x: 0, y: 2, z: 0 };
}
