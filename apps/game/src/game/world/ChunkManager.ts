/**
 * ChunkManager (master spec §21, §75, §77): the non-rendering brain of the world.
 * Bounded active window around the camera focus; at most maxChunkGenerationsPerFrame
 * generations per frame; off-window chunks go RECYCLABLE → DISPOSED (§75) with host
 * callbacks for body/texture cleanup. Pure logic — unit-testable without Phaser (§83).
 */
import type { GameConfig } from "@mef/config";
import {
  transitionChunk,
  applyDamage,
  tickRegen,
  type ChunkData,
  type DamageResult,
} from "./Chunk";
import type { ChunkGenerator } from "./ChunkGenerator";

export interface ChunkHost {
  /** Chunk became ACTIVE: build static bodies + chunk texture (host work). */
  onChunkActivated(chunk: ChunkData): void;
  /** Chunk became RECYCLABLE: remove bodies + recycle texture (§75). */
  onChunkRecycled(chunk: ChunkData): void;
  /** A cell changed so the host can refresh visuals. */
  onCellChanged(chunk: ChunkData, col: number, row: number, result: DamageResult): void;
  /** Generation threw: host logs it (§99: don't hide failures). */
  onGenerationError?(chunkId: number, error: unknown): void;
}

export class ChunkManager {
  private readonly chunks = new Map<number, ChunkData>();
  private readonly activatable: number[] = [];
  private focusRow = 0;
  private generatedTotal = 0;
  private recycledTotal = 0;
  private cellChangesThisFrame = 0;
  /** Timestamp of the current frame's regen pass (used by the final recycle regen). */
  private lastRegenMs = 0;

  /** Run seed for deterministic generation (§10/§112). */
  runSeed = 0;

  constructor(
    private readonly config: GameConfig,
    private readonly generator: ChunkGenerator,
    private readonly host: ChunkHost,
  ) {}

  setRunSeed(seed: number): void {
    this.runSeed = seed >>> 0;
  }

  getFocusRow(): number {
    return this.focusRow;
  }

  get activeCount(): number {
    return this.chunks.size;
  }

  get pendingActivationCount(): number {
    return this.activatable.length;
  }

  get totals(): { generated: number; recycled: number; cellChangesThisFrame: number } {
    return {
      generated: this.generatedTotal,
      recycled: this.recycledTotal,
      cellChangesThisFrame: this.cellChangesThisFrame,
    };
  }

  /** Chunk lookup for hosts/tests. */
  getChunk(id: number): ChunkData | undefined {
    return this.chunks.get(id);
  }

  /**
   * Per-frame update (§77: bounded work). Order: window → generate (budgeted) →
   * activate (budgeted) → recycle → regen.
   */
  update(nowMs: number, focusWorldY: number, blockSizePx: number): void {
    this.cellChangesThisFrame = 0;
    this.lastRegenMs = nowMs;
    this.focusRow = focusWorldY / blockSizePx / this.config.chunkHeight;
    this.ensureWindow();
    this.activateBudgeted();
    this.recycleFarChunks();
    this.regenAll(nowMs);
  }

  /** Apply damage to a cell in a chunk (world coords in cells). */
  damageCell(chunkId: number, col: number, row: number, amount: number, nowMs: number): DamageResult {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return { destroyed: false, changed: false, crackStage: 0 };
    const idx = row * chunk.width + col;
    const cell = chunk.cells[idx];
    if (!cell) return { destroyed: false, changed: false, crackStage: 0 };
    const result = applyDamage(cell, amount, nowMs);
    if (result.changed) {
      this.cellChangesThisFrame++;
      if (result.destroyed) chunk.cells[idx] = null;
      this.host.onCellChanged(chunk, col, row, result);
    }
    return result;
  }

  /**
   * Ensure window chunks exist, generating at most the per-frame budget (§77).
   * §21/§77 loophole guard: the scan always starts AT the window's lowest id (never
   * skips ahead), so if the entry chunk was recycled while the camera moved fast
   * (fastfall into not-yet-generated space, tab-switch delta spike), the hole is
   * refilled first and the pickaxe never outruns generation permanently.
   */
  private ensureWindow(): void {
    const focus = Math.floor(this.focusRow);
    const from = focus - 1;
    const to = focus + this.config.activeChunkWindow;
    let budget = this.config.maxChunkGenerationsPerFrame;
    for (let id = from; id <= to && budget > 0; id++) {
      if (!this.chunks.has(id)) {
        this.generateChunk(id);
        budget--;
      }
    }
  }

  /** Generate one chunk; on error use the safe fallback (§68/§69) and log (§99). */
  private generateChunk(id: number): void {
    try {
      const chunk = this.generator.generate(id, this.runSeed);
      this.chunks.set(id, chunk);
      this.generatedTotal++;
      this.activatable.push(id);
    } catch (error) {
      this.host.onGenerationError?.(id, error);
      const fallback = this.generator.generateFallback(id);
      this.chunks.set(id, fallback);
      this.generatedTotal++;
      this.activatable.push(id);
    }
  }

  /** Promote queued chunks through VALIDATING → ACTIVE with a small per-frame budget. */
  private activateBudgeted(): void {
    let budget = this.config.maxChunkGenerationsPerFrame;
    while (this.activatable.length > 0 && budget > 0) {
      const id = this.activatable.shift()!;
      const chunk = this.chunks.get(id);
      if (!chunk) continue;
      if (!transitionChunk(chunk, "ACTIVE")) continue; // wrong state: skip safely
      try {
        this.host.onChunkActivated(chunk);
      } catch (error) {
        this.host.onGenerationError?.(id, error);
      }
      budget--;
    }
  }

  /**
   * Recycle chunks outside the window (§75: bounded active collection, old ones disposed).
   * §21/§75 loophole guard: chunks leaving the window stop receiving the per-frame regen
   * pass, so a damaged-but-healing chunk would freeze mid-crack — the recycled texture
   * would hold a stale crack frame forever (visible block bugs at chunk boundaries).
   * A final regen pass runs BEFORE disposal to settle every cell to its true state.
   */
  private recycleFarChunks(): void {
    const focus = Math.floor(this.focusRow);
    const min = focus - 2;
    const max = focus + this.config.activeChunkWindow + 2;
    for (const [id, chunk] of this.chunks) {
      if (id >= min && id <= max) continue;
      if (transitionChunk(chunk, "RECYCLABLE")) {
        // Final regen: advance every damaged cell to its settled state so the
        // recycled texture matches the data (no frozen cracks). Uses the same
        // timestamp rules as the live pass — zero timers (§14).
        for (let i = 0; i < chunk.cells.length; i++) {
          const cell = chunk.cells[i];
          if (!cell || cell.type === null || cell.hp >= cell.maxHp) continue;
          tickRegen(cell, this.lastRegenMs, this.config.blockRegenDelayMs, this.config.blockRegenIntervalMs, this.config.blockRegenFraction);
          chunk.cells[i] = cell.hp <= 0 ? null : cell;
        }
        // Visuals are destroyed wholesale right after, so no host cell events needed.
        try {
          this.host.onChunkRecycled(chunk);
        } catch (error) {
          this.host.onGenerationError?.(id, error);
        }
        transitionChunk(chunk, "DISPOSED");
        this.chunks.delete(id);
        this.recycledTotal++;
      }
    }
  }

  /** Regen pass (§14): iterate active chunks' cells via timestamp checks, no timers. */
  private regenAll(nowMs: number): void {
    const { blockRegenDelayMs, blockRegenIntervalMs, blockRegenFraction } = this.config;
    for (const chunk of this.chunks.values()) {
      if (chunk.lifecycle !== "ACTIVE") continue;
      for (let i = 0; i < chunk.cells.length; i++) {
        const cell = chunk.cells[i];
        if (!cell || cell.type === null || cell.hp >= cell.maxHp) continue;
        if (tickRegen(cell, nowMs, blockRegenDelayMs, blockRegenIntervalMs, blockRegenFraction)) {
          const row = Math.floor(i / chunk.width);
          const col = i % chunk.width;
          this.cellChangesThisFrame++;
          this.host.onCellChanged(chunk, col, row, {
            destroyed: false,
            changed: true,
            crackStage: Math.max(0, Math.ceil((1 - cell.hp / cell.maxHp) * 10) - 1),
          });
        }
      }
    }
  }
}
