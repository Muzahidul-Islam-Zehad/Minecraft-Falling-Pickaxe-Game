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
