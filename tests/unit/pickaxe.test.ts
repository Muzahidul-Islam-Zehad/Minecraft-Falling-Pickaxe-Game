import { describe, expect, it } from "vitest";
import { clampBodyMotion, randomTierIndex, type BodyMotion } from "../../apps/game/src/game/entities/pickaxePhysics";
import { DEFAULT_GAME_CONFIG, PICKAXE_DEFINITIONS, validatePickaxeDefinitions } from "@mef/config";

/** Pickaxe tests (master spec §16, §17, §19, §70). */

function motion(partial: Partial<BodyMotion>): BodyMotion {
  return { x: 0, y: 0, velocityX: 0, velocityY: 0, angularVelocity: 0, ...partial };
}

describe("clampBodyMotion (§17, §70: velocity caps, NaN kill switch)", () => {
  it("passes valid motion through unchanged", () => {
    const m = motion({ velocityX: 100, velocityY: -200, angularVelocity: 90 });
    const c = clampBodyMotion(m, DEFAULT_GAME_CONFIG);
    expect(c.valid).toBe(true);
    expect(c.velocityX).toBe(100);
    expect(c.velocityY).toBe(-200);
    expect(c.angularVelocity).toBe(90);
  });

  it("clamps velocity to the configured cap", () => {
    const cap = DEFAULT_GAME_CONFIG.pickaxeMaxVelocityPxPerSec;
    const c = clampBodyMotion(motion({ velocityX: 99_999, velocityY: -99_999 }), DEFAULT_GAME_CONFIG);
    expect(c.velocityX).toBe(cap);
    expect(c.velocityY).toBe(-cap);
  });

  it("clamps angular velocity to the configured cap", () => {
    const cap = DEFAULT_GAME_CONFIG.pickaxeMaxAngularVelocityDegPerSec;
    const c = clampBodyMotion(motion({ angularVelocity: 100_000 }), DEFAULT_GAME_CONFIG);
    expect(c.angularVelocity).toBe(cap);
  });

  it("marks NaN/Infinity motion invalid (§70: never propagate)", () => {
    expect(clampBodyMotion(motion({ velocityX: Number.NaN }), DEFAULT_GAME_CONFIG).valid).toBe(false);
    expect(clampBodyMotion(motion({ velocityY: Number.POSITIVE_INFINITY }), DEFAULT_GAME_CONFIG).valid).toBe(false);
    expect(clampBodyMotion(motion({ x: Number.NaN }), DEFAULT_GAME_CONFIG).valid).toBe(false);
    expect(clampBodyMotion(motion({ angularVelocity: Number.NaN }), DEFAULT_GAME_CONFIG).valid).toBe(false);
  });

  it("snaps near-zero velocities to exact zero (rest hygiene)", () => {
    const c = clampBodyMotion(motion({ velocityX: 1e-9, velocityY: -1e-9 }), DEFAULT_GAME_CONFIG);
    expect(c.velocityX).toBe(0);
    expect(c.velocityY).toBe(0);
  });
});

describe("pickaxe tier catalog (§16, §104: data-driven tiers)", () => {
  it("passes validation", () => {
    expect(validatePickaxeDefinitions()).toEqual([]);
  });

  it("defines all six tiers in §16 order with §16 damage values", () => {
    expect(PICKAXE_DEFINITIONS.map((p) => p.tier)).toEqual([
      "wood", "stone", "iron", "gold", "diamond", "netherite",
    ]);
    expect(PICKAXE_DEFINITIONS.map((p) => p.damage)).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("rejects non-increasing damage and duplicates", () => {
    const bad = [
      { tier: "wood" as const, damage: 5, textureKey: "a" },
      { tier: "stone" as const, damage: 5, textureKey: "b" },
    ];
    expect(validatePickaxeDefinitions(bad).length).toBeGreaterThan(0);
  });
});

describe("randomTierIndex (§114 autonomy skew)", () => {
  it("always returns a valid index", () => {
    for (let i = 0; i < 500; i++) {
      const idx = randomTierIndex(Math.random, 6);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(6);
    }
  });

  it("skews toward low tiers (wood most common)", () => {
    let low = 0;
    for (let i = 0; i < 1000; i++) {
      if (randomTierIndex(Math.random, 6) === 0) low++;
    }
    expect(low).toBeGreaterThan(150);
  });
});
