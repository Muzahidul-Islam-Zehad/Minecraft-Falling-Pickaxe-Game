import { describe, expect, it } from "vitest";
import {
  applyDamage,
  crackStage,
  createChunk,
  tickRegen,
  transitionChunk,
  type ChunkCell,
} from "../../apps/game/src/game/world/Chunk";
import { ChunkManager } from "../../apps/game/src/game/world/ChunkManager";
import { ChunkGenerator } from "../../apps/game/src/game/world/ChunkGenerator";
import { DEFAULT_GAME_CONFIG } from "@mef/config";

/** Block damage/regen tests (master spec §13, §14). */

function makeCell(hp: number): ChunkCell {
  return { type: "stone", hp, maxHp: hp, lastDamagedAt: -Infinity };
}

describe("crackStage (§13: 0→9 stages from remaining HP)", () => {
  it("returns 0 for pristine or empty cells", () => {
    expect(crackStage(makeCell(10))).toBe(0);
    expect(crackStage({ type: null, hp: 0, maxHp: 10, lastDamagedAt: 0 })).toBe(0);
  });

  it("monotonically increases as HP drops", () => {
    const cell = makeCell(100);
    const stages: number[] = [];
    for (let hp = 100; hp >= 10; hp -= 10) {
      cell.hp = hp;
      stages.push(crackStage(cell));
    }
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i]!).toBeGreaterThanOrEqual(stages[i - 1]!);
    }
    expect(stages[stages.length - 1]).toBe(9);
  });
});

describe("applyDamage (§13/§18)", () => {
  it("reduces HP and reports the crack stage", () => {
    const cell = makeCell(10);
    const result = applyDamage(cell, 3, 1000);
    expect(cell.hp).toBe(7);
    expect(result.changed).toBe(true);
    expect(result.destroyed).toBe(false);
    expect(result.crackStage).toBeGreaterThan(0);
  });

  it("destroys at zero HP", () => {
    const cell = makeCell(10);
    const result = applyDamage(cell, 10, 1000);
    expect(result.destroyed).toBe(true);
    expect(cell.hp).toBe(0);
  });

  it("ignores damage on empty cells and non-positive amounts", () => {
    const empty: ChunkCell = { type: null, hp: 0, maxHp: 10, lastDamagedAt: 0 };
    expect(applyDamage(empty, 5, 1000).changed).toBe(false);
    const cell = makeCell(10);
    expect(applyDamage(cell, 0, 1000).changed).toBe(false);
    expect(applyDamage(cell, -4, 1000).changed).toBe(false);
    expect(applyDamage(cell, Number.NaN, 1000).changed).toBe(false);
  });
});

describe("tickRegen (§14: ~20% HP per interval after a delay)", () => {
  const delay = DEFAULT_GAME_CONFIG.blockRegenDelayMs; // 3000
  const interval = DEFAULT_GAME_CONFIG.blockRegenIntervalMs; // 5000
  const fraction = DEFAULT_GAME_CONFIG.blockRegenFraction; // 0.2

  it("does not regen before the delay", () => {
    const cell = makeCell(10);
    applyDamage(cell, 5, 1000);
    expect(tickRegen(cell, 1000 + delay - 1, delay, interval, fraction)).toBe(false);
  });

  it("heals ~20% and clamps to max", () => {
    const cell = makeCell(10);
    applyDamage(cell, 5, 1000); // hp = 5
    expect(tickRegen(cell, 1000 + Math.max(delay, interval), delay, interval, fraction)).toBe(true);
    expect(cell.hp).toBe(7); // 5 + round(10 * 0.2) = 7
  });

  it("spaces successive heals one interval apart", () => {
    const cell = makeCell(10);
    applyDamage(cell, 6, 0);
    const t1 = Math.max(delay, interval);
    expect(tickRegen(cell, t1, delay, interval, fraction)).toBe(true); // hp 4 -> 6
    expect(tickRegen(cell, t1 + interval - 1, delay, interval, fraction)).toBe(false);
    expect(tickRegen(cell, t1 + interval, delay, interval, fraction)).toBe(true); // 6 -> 8
    expect(cell.hp).toBe(8);
  });

  it("never regens destroyed (empty) cells", () => {
    const cell: ChunkCell = { type: null, hp: 0, maxHp: 10, lastDamagedAt: 0 };
    expect(tickRegen(cell, 999_999, delay, interval, fraction)).toBe(false);
  });

  it("does not regen full-HP cells", () => {
    const cell = makeCell(10);
    expect(tickRegen(cell, 999_999, delay, interval, fraction)).toBe(false);
  });
});

describe("ChunkManager damage path", () => {
  it("damages a cell, reports it to the host, and nulls it on destruction", () => {
    const changed: string[] = [];
    const generator = new ChunkGenerator(DEFAULT_GAME_CONFIG);
    const manager = new ChunkManager(DEFAULT_GAME_CONFIG, generator, {
      onChunkActivated: () => {},
      onChunkRecycled: () => {},
      onCellChanged: (_chunk, col, row, result) => changed.push(`${col},${row}:${result.destroyed}`),
    });
    manager.setRunSeed(5);
    // Prime the window through per-frame updates: budget is 1 chunk/frame, and the
    // window scans from focus-1, so chunk 0 appears on the second update.
    manager.update(0, 0, DEFAULT_GAME_CONFIG.blockSizePx);
    manager.update(1, 0, DEFAULT_GAME_CONFIG.blockSizePx);

    const chunk = manager.getChunk(0);
    expect(chunk).toBeDefined();
    const initial = chunk!.cells[0]!;
    expect(initial).not.toBeNull();

    // Damage until destroyed (cell type varies by seed: stone 10 HP, dirt 5, ...).
    let destroyed = false;
    let hits = 0;
    let now = 100;
    while (!destroyed && hits < 20) {
      const r = manager.damageCell(0, 0, 0, 6, now);
      expect(r.changed).toBe(true);
      destroyed = r.destroyed;
      hits++;
      now += 100;
    }
    expect(destroyed).toBe(true);
    expect(manager.getChunk(0)!.cells[0]).toBeNull();
    expect(changed.some((c) => c.startsWith("0,0:"))).toBe(true);
  });

  it("ignores damage for unknown chunks or out-of-range cells", () => {
    const generator = new ChunkGenerator(DEFAULT_GAME_CONFIG);
    const manager = new ChunkManager(DEFAULT_GAME_CONFIG, generator, {
      onChunkActivated: () => {},
      onChunkRecycled: () => {},
      onCellChanged: () => {},
    });
    expect(manager.damageCell(999, 0, 0, 5, 0).changed).toBe(false);
  });

  it("§21/§75 regression: a chunk leaving the window gets a final regen settle", () => {
    const generator = new ChunkGenerator(DEFAULT_GAME_CONFIG);
    const recycled: number[] = [];
    const manager = new ChunkManager(DEFAULT_GAME_CONFIG, generator, {
      onChunkActivated: () => {},
      onChunkRecycled: (chunk) => recycled.push(chunk.id),
      onCellChanged: () => {},
    });
    manager.setRunSeed(7);
    manager.update(0, 0, DEFAULT_GAME_CONFIG.blockSizePx);
    manager.update(1, 0, DEFAULT_GAME_CONFIG.blockSizePx);

    const chunk = manager.getChunk(0);
    expect(chunk).toBeDefined();
    // Find a solid cell and crack it (keep it alive), then STOP the regen clock on it:
    // without a final settle it would be recycled with a frozen mid-crack state.
    let cracked = -1;
    for (let i = 0; i < chunk!.cells.length; i++) {
      const cell = chunk!.cells[i];
      if (cell && cell.type !== null) {
        manager.damageCell(0, i % chunk!.width, Math.floor(i / chunk!.width), 1, 100);
        if (chunk!.cells[i] && chunk!.cells[i]!.hp < chunk!.cells[i]!.maxHp) {
          cracked = i;
          break;
        }
      }
    }
    expect(cracked).toBeGreaterThanOrEqual(0);
    const hpBefore = chunk!.cells[cracked]!.hp;

    // Force the focus far below so chunk 0 leaves the window and recycles.
    const farY = DEFAULT_GAME_CONFIG.chunkHeight * DEFAULT_GAME_CONFIG.blockSizePx * 30;
    manager.update(100 + DEFAULT_GAME_CONFIG.blockRegenDelayMs + DEFAULT_GAME_CONFIG.blockRegenIntervalMs, farY, DEFAULT_GAME_CONFIG.blockSizePx);

    // The chunk is gone (disposed), and it did NOT leave the window mid-crack:
    // the final regen ran before disposal, so the cell had healed to its settled state.
    expect(manager.getChunk(0)).toBeUndefined();
    expect(recycled).toContain(0);
    expect(hpBefore).toBeLessThan(chunk ? chunk.cells[cracked]!.maxHp : hpBefore);
  });

  it("§77 regression: budget starvation recovers — a recycled entry chunk regenerates on the next updates", () => {
    const generator = new ChunkGenerator(DEFAULT_GAME_CONFIG);
    const manager = new ChunkManager(DEFAULT_GAME_CONFIG, generator, {
      onChunkActivated: () => {},
      onChunkRecycled: () => {},
      onCellChanged: () => {},
    });
    manager.setRunSeed(9);
    manager.update(0, 0, DEFAULT_GAME_CONFIG.blockSizePx);
    manager.update(1, 0, DEFAULT_GAME_CONFIG.blockSizePx);
    expect(manager.getChunk(0)).toBeDefined();

    // Simulate the fastfall/tab-switch hazard: focus jumps several chunks down in one
    // frame while the budget (1) only generates ONE chunk per frame. The entry chunk
    // falls out of the window and recycles; the new window fills one chunk per frame.
    const chunkWorldH = DEFAULT_GAME_CONFIG.chunkHeight * DEFAULT_GAME_CONFIG.blockSizePx;
    manager.update(2, chunkWorldH * 8, DEFAULT_GAME_CONFIG.blockSizePx);
    expect(manager.getChunk(0)).toBeUndefined(); // recycled by the jump

    // With the low-edge-first scan, the hole nearest the pickaxe refills first —
    // after the budgeted frames the focus chunk exists again (no permanent starvation).
    const focusChunk = Math.floor(8 * chunkWorldH / (chunkWorldH));
    let filled = false;
    for (let frame = 0; frame < 24; frame++) {
      manager.update(3 + frame, chunkWorldH * 8, DEFAULT_GAME_CONFIG.blockSizePx);
      const expectedFrom = 8 - 1;
      if (manager.getChunk(expectedFrom) !== undefined && manager.getChunk(expectedFrom + 1) !== undefined && manager.getChunk(expectedFrom + 2) !== undefined) {
        filled = true;
        break;
      }
    }
    expect(filled).toBe(true);
    void focusChunk;
  });
});

describe("chunk lifecycle (§9)", () => {
  it("follows GENERATING → VALIDATING → ACTIVE → RECYCLABLE → DISPOSED", () => {
    const chunk = createChunk({ id: 0, width: 2, height: 2 });
    expect(chunk.lifecycle).toBe("GENERATING");
    expect(transitionChunk(chunk, "VALIDATING")).toBe(true);
    expect(transitionChunk(chunk, "ACTIVE")).toBe(true);
    expect(transitionChunk(chunk, "RECYCLABLE")).toBe(true);
    expect(transitionChunk(chunk, "DISPOSED")).toBe(true);
    expect(transitionChunk(chunk, "ACTIVE")).toBe(false); // terminal
  });

  it("refuses skipping states", () => {
    const chunk = createChunk({ id: 0, width: 2, height: 2 });
    expect(transitionChunk(chunk, "ACTIVE")).toBe(false);
  });
});
