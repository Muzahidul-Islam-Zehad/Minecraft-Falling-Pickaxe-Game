/**
 * Pure pickaxe physics helpers (master spec §17, §70).
 * No Phaser imports — unit-testable in Node (§83). The Phaser manager applies these
 * to Arcade bodies each tick.
 */
import type { GameConfig } from "@mef/config";

/** A snapshot of a dynamic body's motion state. */
export interface BodyMotion {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  angularVelocity: number;
}

export interface ClampedMotion {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  angularVelocity: number;
  /** False when any value was non-finite: the body must be despawned (§70). */
  valid: boolean;
}

const EPSILON = 1e-6;

/**
 * Validate and clamp body motion to configured caps (§70):
 * velocity caps, angular velocity cap, and a NaN/Infinity kill switch.
 * Never allow non-finite values to propagate.
 */
export function clampBodyMotion(motion: BodyMotion, config: GameConfig): ClampedMotion {
  const { x, y, velocityX, velocityY, angularVelocity } = motion;
  const finite =
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(velocityX) &&
    Number.isFinite(velocityY) &&
    Number.isFinite(angularVelocity);

  if (!finite) {
    return { x: 0, y: 0, velocityX: 0, velocityY: 0, angularVelocity: 0, valid: false };
  }

  const vMax = config.pickaxeMaxVelocityPxPerSec;
  const aMax = config.pickaxeMaxAngularVelocityDegPerSec;
  const clamp = (v: number, max: number): number =>
    Math.abs(v) < EPSILON ? 0 : Math.max(-max, Math.min(max, v));

  return {
    x,
    y,
    velocityX: clamp(velocityX, vMax),
    velocityY: clamp(velocityY, vMax),
    angularVelocity: clamp(angularVelocity, aMax),
    valid: true,
  };
}

/** Weighted random tier pick for the autonomous spawner (§114): mostly low tiers. */
export function randomTierIndex(rng: () => number, tierCount: number): number {
  // Skew toward index 0 (wood) with a decaying distribution.
  const roll = Math.floor(Math.abs(rng() - rng()) * tierCount);
  return Math.min(tierCount - 1, Math.max(0, roll));
}

/** Spin below this magnitude (deg/s) is snapped to zero: rest hygiene, §70 style. */
const SPIN_EPSILON = 25;

/**
 * Realistic tumble (§17): convert a bounce impact into angular velocity. The pickaxe is
 * a rigid object — it only spins when something hits/rolls it, never by constant force.
 *
 * - Floor/ceiling impact (|normalY| dominant): horizontal speed becomes ROLL — direction
 *   follows velocity sign (moving right → clockwise roll, positive in Phaser's y-down).
 * - Side impact (|normalX| dominant): vertical speed becomes tumble away from the wall.
 * - Result clamped to the angular cap; tiny values snap to zero so it can come to rest.
 */
export function tumbleFromImpact(
  velocityX: number,
  velocityY: number,
  normalX: number,
  normalY: number,
  config: GameConfig,
): number {
  const factor = config.pickaxeTumbleVelocityToSpinFactor;
  let spin: number;
  if (Math.abs(normalY) >= Math.abs(normalX)) {
    // Rolling along a horizontal surface.
    spin = velocityX * factor * Math.sign(normalY || -1);
  } else {
    // Tumbling off a vertical surface, away from it.
    spin = velocityY * factor * -Math.sign(normalX || 1);
  }
  if (Math.abs(spin) < SPIN_EPSILON) return 0;
  const cap = config.pickaxeMaxAngularVelocityDegPerSec;
  return Math.max(-cap, Math.min(cap, spin));
}

/** Contact faces captured from an Arcade body in one physics step (§17, §18). */
export interface ContactFlags {
  down: boolean;
  up: boolean;
  left: boolean;
  right: boolean;
}

/** True when any face is pressed against something solid. */
export function hasAnyContact(c: ContactFlags): boolean {
  return c.down || c.up || c.left || c.right;
}

/**
 * Newton's 3rd law rebound (§17): the block pushes back along the contact normal with
 * speed proportional to the impact speed — hit a wall fast, get thrown back hard.
 * Impacts below the configured minimum are ignored so resting contact never kicks
 * (otherwise the pickaxe would levitate on its own rebounds).
 *
 * @param incomingVx Velocity from before the collision (X axis).
 * @param incomingVy Velocity from before the collision (Y axis, y-down: falling is +).
 * @returns Velocity to apply away from each contacted surface (0 = no rebound).
 */
export function reboundSpeed(
  incomingVx: number,
  incomingVy: number,
  contacts: ContactFlags,
  config: GameConfig,
): { x: number; y: number } {
  const factor = config.pickaxeReboundFactor;
  const min = config.pickaxeReboundMinImpactPxPerSec;
  let x = 0;
  let y = 0;
  if (contacts.down && Math.abs(incomingVy) >= min) {
    y = -Math.abs(incomingVy) * factor; // floor pushes it back up
  } else if (contacts.up && Math.abs(incomingVy) >= min) {
    y = Math.abs(incomingVy) * factor; // ceiling pushes it back down
  }
  if (contacts.left && Math.abs(incomingVx) >= min) {
    x = Math.abs(incomingVx) * factor; // left wall pushes it right
  } else if (contacts.right && Math.abs(incomingVx) >= min) {
    x = -Math.abs(incomingVx) * factor; // right wall pushes it left
  }
  return { x, y };
}

/**
 * Grinding latch (§18): collision flags flicker off while the cosmetic strike hop lifts
 * the pickaxe off the block (~290 ms of every 240 ms cycle). Mining must NOT pause with
 * them — once a face has contact, grinding state persists for a short latch window so
 * damage keeps flowing through the hop at full rate. Pure helper (§83).
 *
 * @returns Updated latch value in ms (full window on contact; decays to 0 otherwise).
 */
export function updateGrindLatch(
  hasContact: boolean,
  currentMs: number,
  deltaMs: number,
  config: GameConfig,
): number {
  if (hasContact) return config.pickaxeGrindLatchMs;
  return Math.max(0, currentMs - deltaMs);
}

/**
 * Mining strike rhythm (§17): while grinding a block the pickaxe hops on a fixed
 * cadence — reads as the tool striking rather than resting on the block.
 *
 * @param grounded True while the body is pressed on a surface (blocked.down).
 * @param accumulatedMs Strike timer carried between frames (mutated by the caller).
 * @returns True exactly when a strike fires this frame; the caller applies the kick.
 */
export function shouldStrikeBounce(
  grounded: boolean,
  accumulatedMs: number,
  config: GameConfig,
): boolean {
  if (!grounded) return false; // strikes only happen while pressing on a block
  return accumulatedMs >= config.pickaxeMiningBounceIntervalMs;
}
