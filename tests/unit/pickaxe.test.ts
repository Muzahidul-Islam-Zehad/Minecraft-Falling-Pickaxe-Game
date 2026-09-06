import { describe, expect, it } from "vitest";
import {
  clampBodyMotion,
  hasAnyContact,
  reboundSpeed,
  randomTierIndex,
  shouldStrikeBounce,
  tumbleFromImpact,
  updateGrindLatch,
  type BodyMotion,
  type ContactFlags,
} from "../../apps/game/src/game/entities/pickaxePhysics";
import {
  DEFAULT_GAME_CONFIG,
  PICKAXE_DEFINITIONS,
  validateGameConfig,
  validatePickaxeDefinitions,
} from "@mef/config";

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

describe("tumbleFromImpact (§17: rigid-object tumble from bounces)", () => {
  it("converts horizontal speed into roll on a floor impact", () => {
    // Moving right at 300 px/s onto a floor (normal +Y): spins clockwise/positive.
    const spin = tumbleFromImpact(300, 0, 0, 1, DEFAULT_GAME_CONFIG);
    expect(spin).toBe(300 * DEFAULT_GAME_CONFIG.pickaxeTumbleVelocityToSpinFactor);
    expect(spin).toBeGreaterThan(0);
  });

  it("roll direction follows velocity sign", () => {
    const right = tumbleFromImpact(200, -400, 0, 1, DEFAULT_GAME_CONFIG);
    const left = tumbleFromImpact(-200, -400, 0, 1, DEFAULT_GAME_CONFIG);
    expect(right).toBeGreaterThan(0);
    expect(left).toBeLessThan(0);
  });

  it("converts vertical speed into tumble on a side impact", () => {
    // Phaser is y-down, so FALLING is positive vy. Falling into a wall on its right
    // (normal +X) tumbles it counterclockwise (negative), away from the wall.
    const spin = tumbleFromImpact(0, 350, 1, 0, DEFAULT_GAME_CONFIG);
    expect(spin).toBe(-350 * DEFAULT_GAME_CONFIG.pickaxeTumbleVelocityToSpinFactor);
    // Mirror case: wall on its left flips the tumble direction.
    const mirrored = tumbleFromImpact(0, 350, -1, 0, DEFAULT_GAME_CONFIG);
    expect(mirrored).toBe(350 * DEFAULT_GAME_CONFIG.pickaxeTumbleVelocityToSpinFactor);
  });

  it("clamps spin to the angular cap (§70)", () => {
    const cap = DEFAULT_GAME_CONFIG.pickaxeMaxAngularVelocityDegPerSec;
    const spin = tumbleFromImpact(5000, 0, 0, 1, DEFAULT_GAME_CONFIG);
    expect(Math.abs(spin)).toBe(cap);
  });

  it("snaps tiny nudges to zero so it can come to rest", () => {
    const spin = tumbleFromImpact(5, 0, 0, 1, DEFAULT_GAME_CONFIG); // 5 × 0.8 = 4 deg/s
    expect(spin).toBe(0);
  });

  it("treats dominant axis correctly for diagonal contacts", () => {
    // normalY=1 dominates normalX=0.5 → floor roll, not wall tumble.
    const spin = tumbleFromImpact(150, 0, 0.5, 1, DEFAULT_GAME_CONFIG);
    expect(spin).toBeGreaterThan(0);
  });
});

describe("shouldStrikeBounce (§17: mining strike rhythm)", () => {
  const interval = DEFAULT_GAME_CONFIG.pickaxeMiningBounceIntervalMs;

  it("never strikes while airborne, even with a full timer", () => {
    expect(shouldStrikeBounce(false, interval + 1000, DEFAULT_GAME_CONFIG)).toBe(false);
  });

  it("strikes when grounded once the interval elapses", () => {
    expect(shouldStrikeBounce(true, interval, DEFAULT_GAME_CONFIG)).toBe(true);
    expect(shouldStrikeBounce(true, interval * 3, DEFAULT_GAME_CONFIG)).toBe(true);
  });

  it("does not strike before the interval elapses", () => {
    expect(shouldStrikeBounce(true, interval - 1, DEFAULT_GAME_CONFIG)).toBe(false);
    expect(shouldStrikeBounce(true, 0, DEFAULT_GAME_CONFIG)).toBe(false);
  });
});

describe("reboundSpeed (§17: Newton's 3rd law bounce-back)", () => {
  const contacts = (partial: Partial<ContactFlags>): ContactFlags => ({
    down: false,
    up: false,
    left: false,
    right: false,
    ...partial,
  });

  it("pushes back off a floor proportional to the impact speed", () => {
    // Falling (positive vy in y-down Phaser) onto a floor → upward (negative) rebound.
    const r = reboundSpeed(0, 200, contacts({ down: true }), DEFAULT_GAME_CONFIG);
    expect(r.y).toBe(-200 * DEFAULT_GAME_CONFIG.pickaxeReboundFactor);
    expect(r.x).toBe(0);
  });

  it("pushes away from a left wall with equal magnitude (3rd law)", () => {
    // Moving left (negative vx) into a left wall → positive (rightward) rebound.
    const r = reboundSpeed(-300, 0, contacts({ left: true }), DEFAULT_GAME_CONFIG);
    expect(r.x).toBe(300 * DEFAULT_GAME_CONFIG.pickaxeReboundFactor);
    expect(r.y).toBe(0);
  });

  it("pushes away from a right wall (mirror case)", () => {
    const r = reboundSpeed(250, 0, contacts({ right: true }), DEFAULT_GAME_CONFIG);
    expect(r.x).toBe(-250 * DEFAULT_GAME_CONFIG.pickaxeReboundFactor);
  });

  it("ceilings push it back down", () => {
    const r = reboundSpeed(0, -150, contacts({ up: true }), DEFAULT_GAME_CONFIG);
    expect(r.y).toBe(150 * DEFAULT_GAME_CONFIG.pickaxeReboundFactor);
  });

  it("ignores impacts below the minimum so resting contact never kicks", () => {
    const min = DEFAULT_GAME_CONFIG.pickaxeReboundMinImpactPxPerSec;
    const resting = reboundSpeed(0, min - 1, contacts({ down: true }), DEFAULT_GAME_CONFIG);
    expect(resting.x).toBe(0);
    expect(resting.y).toBe(0);
    const hit = reboundSpeed(0, min + 1, contacts({ down: true }), DEFAULT_GAME_CONFIG);
    expect(hit.y).toBeLessThan(0);
  });

  it("no contact → no rebound", () => {
    const r = reboundSpeed(500, 500, contacts({}), DEFAULT_GAME_CONFIG);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("rejects an invalid rebound factor (config validation)", () => {
    const bad = { ...DEFAULT_GAME_CONFIG, pickaxeReboundFactor: 1.5 };
    expect(validateGameConfig(bad).length).toBeGreaterThan(0);
  });
});

describe("hasAnyContact (§18: any pressed face is minable)", () => {
  const none: ContactFlags = { down: false, up: false, left: false, right: false };

  it("is false only when every face is free", () => {
    expect(hasAnyContact(none)).toBe(false);
  });

  it("is true for each single-face contact", () => {
    expect(hasAnyContact({ ...none, down: true })).toBe(true);
    expect(hasAnyContact({ ...none, up: true })).toBe(true);
    expect(hasAnyContact({ ...none, left: true })).toBe(true);
    expect(hasAnyContact({ ...none, right: true })).toBe(true);
  });
});

describe("updateGrindLatch (§18: mining survives the strike hop)", () => {
  const latch = DEFAULT_GAME_CONFIG.pickaxeGrindLatchMs;

  it("refills to the full window while contact lasts", () => {
    expect(updateGrindLatch(true, 0, 16, DEFAULT_GAME_CONFIG)).toBe(latch);
    expect(updateGrindLatch(true, latch - 5, 16, DEFAULT_GAME_CONFIG)).toBe(latch);
  });

  it("decays after contact stops and clamps at zero", () => {
    expect(updateGrindLatch(false, latch, 100, DEFAULT_GAME_CONFIG)).toBe(latch - 100);
    expect(updateGrindLatch(false, 50, 100, DEFAULT_GAME_CONFIG)).toBe(0);
    expect(updateGrindLatch(false, 0, 16, DEFAULT_GAME_CONFIG)).toBe(0);
  });

  it("keeps grinding alive through a hop longer than the strike interval", () => {
    // Strike hop breaks contact ~290 ms; latch (400 ms) must cover it → mining never
    // pauses, restoring the ~100% duty cycle the old down-only probe had.
    let state = latch;
    state = updateGrindLatch(true, state, 16, DEFAULT_GAME_CONFIG); // land
    state = updateGrindLatch(false, state, 300, DEFAULT_GAME_CONFIG); // mid-hop
    expect(state).toBeGreaterThan(0);
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
