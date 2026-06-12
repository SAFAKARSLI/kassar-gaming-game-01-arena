/**
 * Arena geometry — shared so the server collides against the exact shapes the
 * client renders.
 *
 * The arena is an enclosed circular **medieval gladiator pit**: a flat sand
 * floor ringed by a stone wall, with a couple of low raised stone platforms and
 * a few ruined cover pillars for melee positioning. Players are contained inside
 * the ring (no ring-outs) — death is by HP. `DEATH_Y` remains only as a safety
 * net.
 *
 * The camera looks down the -Z axis, so the *front* of the arena (+Z, nearest
 * the camera) is kept open/low and all the tall scenery (stands, towers, castle)
 * sits on the far side (-Z).
 */

/** Radius of the sand combat pit (inside face of the wall). */
export const ARENA_RADIUS = 14;

/** Top surface Y of the sand floor. */
export const ARENA_FLOOR_Y = 0;

/** Height of the surrounding stone wall. */
export const WALL_HEIGHT = 4.5;

/** Thickness of the stone wall ring. */
export const WALL_THICKNESS = 1.2;

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

/**
 * Flat collision surfaces (players land on the tops). The first is the sand
 * floor pad; the rest are low raised stone platforms for verticality. The
 * raised platforms sit toward the back (-Z) so they never block the camera.
 */
export const PLATFORMS: readonly Platform[] = [
  // Sand floor (collision pad — the pretty disc is rendered separately).
  { cx: 0, cy: -0.5, cz: 0, hx: ARENA_RADIUS + 1, hy: 0.5, hz: ARENA_RADIUS + 1, color: '#d9c08a' },
  // Two low raised stone platforms.
  { cx: -6.5, cy: 0.9, cz: -3.5, hx: 2.2, hy: 0.45, hz: 1.7, color: '#9a9080' },
  { cx: 6.5, cy: 0.9, cz: -3.5, hx: 2.2, hy: 0.45, hz: 1.7, color: '#9a9080' },
];

export interface CoverPillar {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height: number;
  /** Broken/ruined columns are shorter and rubble-colored. */
  readonly broken: boolean;
}

/** Ruined columns used as cover — solid circular collision (kept sparse so combat stays readable). */
export const COVER_PILLARS: readonly CoverPillar[] = [
  { x: -3.8, z: 2.8, radius: 0.55, height: 2.4, broken: false },
  { x: 3.8, z: 2.8, radius: 0.55, height: 2.4, broken: false },
  { x: 0, z: -5.5, radius: 0.7, height: 1.5, broken: true },
];

/**
 * Three spawn gates set into the wall (left, right, back). Players spawn just
 * inside their gate, facing the center.
 */
export interface SpawnGate {
  /** Position on the wall ring. */
  readonly x: number;
  readonly z: number;
  /** Angle (radians) of the gate around the ring, for rendering the archway. */
  readonly angle: number;
  /** Facing direction (X axis) when the fighter walks in. */
  readonly facing: number;
}

// `angle` follows three.js CylinderGeometry convention: x = R·sin(θ), z = R·cos(θ).
// Front (θ=0, +Z) is left open for the camera, so gates sit at the sides + back.
export const SPAWN_GATES: readonly SpawnGate[] = [
  { x: -ARENA_RADIUS, z: 0, angle: -Math.PI / 2, facing: 1 }, // left
  { x: ARENA_RADIUS, z: 0, angle: Math.PI / 2, facing: -1 }, // right
  { x: 0, z: -ARENA_RADIUS, angle: Math.PI, facing: 1 }, // back
];

/** Spawn just inside each gate. */
export const SPAWN_POINTS: readonly { x: number; y: number; z: number }[] = SPAWN_GATES.map(
  (g) => ({ x: g.x * 0.82, y: 2, z: g.z * 0.82 }),
);

/** Predefined crate spawn points spread across the pit (center, platforms, a ring). */
export const CRATE_SPAWN_POINTS: readonly { x: number; y: number; z: number }[] = [
  { x: 0, y: 1.4, z: 0 },
  { x: -6.5, y: 2.3, z: -3.5 },
  { x: 6.5, y: 2.3, z: -3.5 },
  { x: -4.5, y: 1.4, z: 4.5 },
  { x: 4.5, y: 1.4, z: 4.5 },
  { x: -9, y: 1.4, z: 0 },
  { x: 9, y: 1.4, z: 0 },
  { x: 0, y: 1.4, z: 7 },
  { x: 0, y: 1.4, z: -8 },
  { x: -5, y: 1.4, z: -7 },
  { x: 5, y: 1.4, z: -7 },
  { x: 2.5, y: 1.4, z: 2.5 },
];

export function spawnPoint(index: number): { x: number; y: number; z: number } {
  return SPAWN_POINTS[index % SPAWN_POINTS.length] ?? { x: 0, y: 2, z: 0 };
}
