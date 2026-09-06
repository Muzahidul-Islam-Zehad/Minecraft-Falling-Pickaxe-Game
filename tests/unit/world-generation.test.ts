import { describe, expect, it } from "vitest";
import { SeededRandom, deriveChunkSeed, hashSeed } from "../../apps/game/src/game/world/SeededRandom";
import { ChunkGenerator } from "../../apps/game/src/game/world/ChunkGenerator";
import { DEFAULT_GAME_CONFIG, validateBlockDefinitions } from "@mef/config";

/** World generation tests (master spec §10, §11, §69). */

describe("SeededRandom (§10: deterministic generation)", () => {
  it("produces identical sequences for identical seeds", () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("stays within [0,1)", () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("hashSeed is deterministic and order-sensitive", () => {
    expect(hashSeed(7, 42)).toBe(hashSeed(7, 42));
    expect(hashSeed(7, 42)).not.toBe(hashSeed(42, 7));
  });

  it("deriveChunkSeed binds chunk identity to the run seed", () => {
    expect(deriveChunkSeed(1000, 5)).toBe(deriveChunkSeed(1000, 5));
    expect(deriveChunkSeed(1000, 5)).not.toBe(deriveChunkSeed(2000, 5));
    expect(deriveChunkSeed(1000, 5)).not.toBe(deriveChunkSeed(1000, 6));
  });
});

describe("ChunkGenerator (§10, §11, §69)", () => {
  const generator = new ChunkGenerator(DEFAULT_GAME_CONFIG);

  it("generates identical chunks for the same runSeed and chunkId", () => {
    const a = generator.generate(3, 777);
    const b = generator.generate(3, 777);
    expect(a.cells.map((c) => c?.type)).toEqual(b.cells.map((c) => c?.type));
    expect(a.cells.map((c) => c?.hp)).toEqual(b.cells.map((c) => c?.hp));
  });

  it("generates different chunks for different seeds or chunk ids", () => {
    const a = generator.generate(3, 777);
    const b = generator.generate(3, 778);
    const c = generator.generate(4, 777);
    expect(a.cells.map((cell) => cell?.type)).not.toEqual(b.cells.map((cell) => cell?.type));
    expect(a.cells.map((cell) => cell?.type)).not.toEqual(c.cells.map((cell) => cell?.type));
  });

  it("fills every cell with a valid type and positive HP (solid world)", () => {
    const chunk = generator.generate(0, 42);
    for (const cell of chunk.cells) {
      expect(cell).not.toBeNull();
      expect(cell!.type).toBeTruthy();
      expect(cell!.hp).toBeGreaterThan(0);
      expect(cell!.maxHp).toBe(cell!.hp);
    }
  });

  it("produces the same fallback chunk for the same chunkId (§69)", () => {
    const a = generator.generateFallback(9);
    const b = generator.generateFallback(9);
    expect(a.cells.map((c) => c?.type)).toEqual(b.cells.map((c) => c?.type));
  });

  it("fallback is mostly stone with only coal/iron extras (§69)", () => {
    const chunk = generator.generateFallback(2);
    let stone = 0;
    let extras = 0;
    for (const cell of chunk.cells) {
      if (cell?.type === "stone") stone++;
      else if (cell?.type === "coal" || cell?.type === "iron") extras++;
      else throw new Error(`fallback generated invalid type ${cell?.type ?? "null"}`);
    }
    expect(extras).toBeLessThan(stone / 2);
    expect(stone + extras).toBe(chunk.width * chunk.height);
  });

  it("new chunks start in GENERATING and move to VALIDATING", () => {
    const chunk = generator.generate(1, 1);
    expect(chunk.lifecycle).toBe("VALIDATING");
  });
});

describe("block catalog (§11, §12, §136)", () => {
  it("passes its own validation", () => {
    expect(validateBlockDefinitions()).toEqual([]);
  });

  it("gives bedrock effectively unbreakable HP and zero rarity", () => {
    const def = BLOCK_DEFINITIONS_FIND("bedrock");
    expect(def!.hp).toBe(1_000_000_000);
    expect(def!.rarity).toBe(0);
  });

  it("gives ores higher HP than plain stone (§12)", () => {
    const stone = BLOCK_DEFINITIONS_FIND("stone")!.hp;
    for (const id of ["coal", "iron", "gold", "diamond"] as const) {
      expect(BLOCK_DEFINITIONS_FIND(id)!.hp).toBeGreaterThan(stone);
    }
  });
});

/// helper import placed at bottom to keep the file tidy
import { BLOCK_DEFINITIONS as _BD } from "@mef/config";
function BLOCK_DEFINITIONS_FIND(id: string) {
  return _BD.find((b) => b.id === id);
}
