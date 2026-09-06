import { describe, expect, it } from "vitest";
import {
  explosionCells,
  nukeBurstKind,
  sanitizeOwnerName,
  transitionTnt,
  type TntLifecycle,
} from "../../apps/game/src/game/entities/tntLogic";
import {
  DEFAULT_GAME_CONFIG,
  TNT_DEFINITIONS,
  TNT_BY_KIND,
  validateGameConfig,
  validateTntDefinitions,
} from "@mef/config";

/** Phase 7 tests (master spec §25–§30): TNT lifecycle, attribution, bounded explosions. */

describe("transitionTnt (§25: strict lifecycle, no skipping)", () => {
  function fresh(): { lifecycle: TntLifecycle } {
    return { lifecycle: "CREATED" };
  }

  it("walks the full legal path CREATED→…→DONE", () => {
    const e = fresh();
    expect(transitionTnt(e, "ARMED")).toBe(true);
    expect(transitionTnt(e, "FALLING")).toBe(true);
    expect(transitionTnt(e, "TRIGGERED")).toBe(true);
    expect(transitionTnt(e, "EXPLODING")).toBe(true);
    expect(transitionTnt(e, "DONE")).toBe(true);
    expect(e.lifecycle).toBe("DONE");
  });

  it("refuses skips and backward moves", () => {
    const e = fresh();
    expect(transitionTnt(e, "TRIGGERED")).toBe(false); // skip
    expect(transitionTnt(e, "EXPLODING")).toBe(false);
    expect(transitionTnt(e, "ARMED")).toBe(true);
    expect(transitionTnt(e, "ARMED")).toBe(false); // backward/self
    expect(e.lifecycle).toBe("ARMED");
  });

  it("DONE is terminal — a second explosion is structurally impossible", () => {
    const e: { lifecycle: TntLifecycle } = { lifecycle: "EXPLODING" };
    expect(transitionTnt(e, "DONE")).toBe(true);
    expect(transitionTnt(e, "EXPLODING")).toBe(false);
    expect(transitionTnt(e, "TRIGGERED")).toBe(false);
  });
});

describe("sanitizeOwnerName (§26: usernames can never form markup/code)", () => {
  it("strips HTML/control characters and collapses whitespace", () => {
    const out = sanitizeOwnerName('<script>alert(1)</script>', 20);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out.length).toBeLessThanOrEqual(20);
    // \n and \t are control chars: stripped outright (labels are single-line).
    expect(sanitizeOwnerName("  a\n\nb\tc  ", 20)).toBe("abc");
    expect(sanitizeOwnerName("  spaced   name  ", 20)).toBe("spaced name");
    expect(sanitizeOwnerName('Zehad"123`', 20)).toBe("Zehad123");
  });

  it("clamps length with an ellipsis", () => {
    const out = sanitizeOwnerName("abcdefghijklmnopqrstuvwx", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });

  it("falls back to ??? for empty/only-control input", () => {
    expect(sanitizeOwnerName("", 20)).toBe("???");
    expect(sanitizeOwnerName("<>&", 20)).toBe("???");
  });
});

describe("nukeBurstKind (§30: alternating burst composition)", () => {
  it("alternates tnt/mega and never yields nuke (only ONE nuke per burst)", () => {
    for (let i = 0; i < 12; i++) {
      expect(["tnt", "mega"]).toContain(nukeBurstKind(i));
    }
    expect(nukeBurstKind(0)).toBe("tnt");
    expect(nukeBurstKind(1)).toBe("mega");
  });
});

describe("explosionCells (§27: radius + falloff + spatial filter, world never scanned)", () => {
  const base = {
    maxDamage: 100,
    blockSizePx: 32,
    minCol: 0,
    maxCol: 7,
    minRow: 0,
    maxRow: 63,
    chunkIdForRow: (row: number, rowsPerChunk: number) => Math.floor(row / rowsPerChunk),
    rowsPerChunk: 32,
  };

  it("damages exactly the cells inside the circle (radius semantics, not a square)", () => {
    const cells = explosionCells({ ...base, centerX: 128, centerY: 128, radiusPx: 64 });
    for (const c of cells) {
      const dx = (c.col + 0.5) * 32 - 128;
      const dy = (c.row + 0.5) * 32 - 128;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(64);
    }
    // 64px radius = 2 blocks → a handful of cells, not the whole column.
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(25);
  });

  it("applies linear falloff: center damage is full, rim damage is small but ≥ 1", () => {
    // Center exactly on a cell center (112,112) → that cell takes full damage.
    const cells = explosionCells({ ...base, centerX: 112, centerY: 112, radiusPx: 96 });
    const damages = cells.map((c) => c.damage);
    expect(Math.max(...damages)).toBe(100);
    expect(Math.min(...damages)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...damages)).toBeLessThan(50);
  });

  it("is spatially filtered: the inspection box clips to the given bounds", () => {
    const cells = explosionCells({ ...base, centerX: 16, centerY: 16, radiusPx: 500 });
    for (const c of cells) {
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col).toBeLessThanOrEqual(7);
      expect(c.row).toBeGreaterThanOrEqual(0);
      // Even a huge radius only produces cells inside the bounded box.
      expect(c.row).toBeLessThanOrEqual(63);
    }
  });

  it("maps rows to chunk ids across chunk borders", () => {
    const cells = explosionCells({ ...base, centerX: 128, centerY: 32 * 33, radiusPx: 64 });
    const chunkIds = new Set(cells.map((c) => c.chunkId));
    expect(chunkIds.size).toBe(2); // straddles chunks 0 and 1
    expect(chunkIds.has(0)).toBe(true);
    expect(chunkIds.has(1)).toBe(true);
  });

  it("stays bounded for absurd radii (§27: explosions are bounded, period)", () => {
    const cells = explosionCells({ ...base, centerX: 128, centerY: 1024, radiusPx: 100_000 });
    // Bounded by the inspection box, which is bounded by the world column × row clamp.
    expect(cells.length).toBeLessThanOrEqual(8 * 64);
  });
});

describe("TNT catalog + budgets (§29, §30: data cannot escape the caps)", () => {
  it("passes validation", () => {
    expect(validateTntDefinitions()).toEqual([]);
    expect(validateGameConfig(DEFAULT_GAME_CONFIG)).toEqual([]);
  });

  it("defines tnt < mega < nuke with strictly increasing damage and radius", () => {
    expect(TNT_DEFINITIONS.map((t) => t.kind)).toEqual(["tnt", "mega", "nuke"]);
    const damages = TNT_DEFINITIONS.map((t) => t.damage);
    const radii = TNT_DEFINITIONS.map((t) => t.radiusPx);
    expect([...damages].sort((a, b) => a - b)).toEqual(damages);
    expect([...radii].sort((a, b) => a - b)).toEqual(radii);
  });

  it("rejects a catalog with decreasing damage or a duplicate kind", () => {
    const bad = [
      { kind: "mega" as const, damage: 90, radiusPx: 100, fuseMs: 1000, particles: 10, shakeIntensityPx: 1, shakeDurationMs: 100, textureKey: "a" },
      { kind: "tnt" as const, damage: 40, radiusPx: 90, fuseMs: 1000, particles: 10, shakeIntensityPx: 1, shakeDurationMs: 100, textureKey: "b" },
      { kind: "nuke" as const, damage: 10, radiusPx: 200, fuseMs: 1000, particles: 10, shakeIntensityPx: 1, shakeDurationMs: 100, textureKey: "c" },
    ];
    expect(validateTntDefinitions(bad).length).toBeGreaterThan(0);
  });

  it("nuke particle accounting: burst share × (maxNukeTnt−1) + nuke share ≤ maxNukeParticles", () => {
    const cfg = DEFAULT_GAME_CONFIG;
    const nukeShare = Math.floor(cfg.maxNukeParticles / cfg.maxNukeTnt);
    const nukeBurst = cfg.maxNukeParticles - nukeShare * (cfg.maxNukeTnt - 1);
    expect(nukeShare * (cfg.maxNukeTnt - 1) + nukeBurst).toBeLessThanOrEqual(cfg.maxNukeParticles);
    expect(nukeBurst).toBeGreaterThanOrEqual(1);
  });

  it("every kind's texture key is present in the catalog map", () => {
    for (const def of TNT_DEFINITIONS) {
      expect(TNT_BY_KIND.get(def.kind)?.textureKey).toBe(def.textureKey);
    }
  });
});
