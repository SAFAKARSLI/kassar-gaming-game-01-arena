/**
 * Global, server-authoritative game constants.
 *
 * Both the Colyseus server simulation and the client prediction layer import
 * these so their kinematics match exactly. Tune gameplay here.
 */

/** Maximum players allowed in a single room. */
export const MAX_PLAYERS = 3;

/** Starting / max health for every player. */
export const MAX_HP = 100;

/** Points needed to win the whole match. */
export const TARGET_SCORE = 5;

/** Server simulation tick rate (Hz). */
export const TICK_RATE = 30;

/** Fixed simulation timestep in seconds. */
export const FIXED_DT = 1 / TICK_RATE;

/** How often the client samples input and sends it to the server (Hz). */
export const INPUT_SEND_RATE = 30;

// ---------------------------------------------------------------------------
// Movement / physics
// ---------------------------------------------------------------------------

/** Gravity acceleration (units / s^2). */
export const GRAVITY = 38;

/** Horizontal ground movement speed (units / s). */
export const MOVE_SPEED = 9;

/** Speed multiplier applied while blocking. */
export const BLOCK_MOVE_MULTIPLIER = 0.45;

/** Per-second control authority on the ground (how fast we reach target velocity). */
export const GROUND_CONTROL = 18;

/** Per-second control authority in the air. */
export const AIR_CONTROL = 6;

/** Upward velocity applied on jump. */
export const JUMP_VELOCITY = 15;

/** Players may jump twice before landing (double jump for recovery). */
export const MAX_JUMPS = 2;

/** Dash horizontal impulse. */
export const DASH_IMPULSE = 18;

/** Dash cooldown in milliseconds. */
export const DASH_COOLDOWN_MS = 2000;

/** Seconds of "hit stun" after taking a hit — input control is disabled so knockback flings cleanly. */
export const HIT_STUN = 0.28;

/** Linear damping applied to velocity every second while grounded (friction). */
export const GROUND_FRICTION = 9;

/** Linear damping applied to knockback/air velocity every second while airborne. */
export const AIR_DRAG = 0.6;

/** Radius used for player vs. player and player vs. crate proximity checks. */
export const PLAYER_RADIUS = 0.55;

/** Half-height of the player capsule (used for ground collision). */
export const PLAYER_HALF_HEIGHT = 0.9;

/** Y position below which a player instantly dies (fell off the map). */
export const DEATH_Y = -25;

// ---------------------------------------------------------------------------
// Round flow timing (milliseconds)
// ---------------------------------------------------------------------------

/** Countdown shown before a round begins. */
export const COUNTDOWN_MS = 3000;

/** How long the "X wins the round" banner shows before the next round. */
export const ROUND_END_MS = 5000;

// ---------------------------------------------------------------------------
// Weapon crates
// ---------------------------------------------------------------------------

/** Minimum / maximum delay between crate spawns (ms). */
export const CRATE_SPAWN_MIN_MS = 10000;
export const CRATE_SPAWN_MAX_MS = 15000;

/** Maximum number of crates that can exist at once. */
export const MAX_CRATES = 3;

/** Size (edge length) of a crate cube. */
export const CRATE_SIZE = 0.8;

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

/** Damage and knockback are reduced by this fraction while blocking. */
export const BLOCK_REDUCTION = 0.7;

// ---------------------------------------------------------------------------
// Player colors (indexed by join order)
// ---------------------------------------------------------------------------

export const PLAYER_COLORS: readonly string[] = ['#3b82f6', '#ef4444', '#22c55e'];
export const PLAYER_COLOR_NAMES: readonly string[] = ['Blue', 'Red', 'Green'];
