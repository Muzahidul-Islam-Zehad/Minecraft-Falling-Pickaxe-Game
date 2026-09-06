/**
 * StatsTracker (master spec §24): destroyed-block counters for the rewards HUD.
 * Pure logic — no Phaser — so it is unit-testable in Node (§83).
 *
 * Loophole guards:
 * - Keys are bounded by the block catalog: unknown types are refused, so the counter
 *   map can never grow unbounded no matter what garbage arrives (§19 hygiene).
 * - Snapshots are copies: HUD code cannot mutate the tracker's internal state.
 */
import type { BlockType } from "@mef/config";

export interface StatsSnapshot {
  readonly blocksDestroyed: number;
  /** Destroyed count per block type — includes reward-less types (stone, dirt, ...). */
  readonly byType: Readonly<Record<string, number>>;
}

export class StatsTracker {
  private readonly counts = new Map<BlockType, number>();
  private total = 0;

  /** Record one destroyed block. Unknown types are ignored (bounded keys, §19). */
  recordDestroyed(type: BlockType, knownTypes: ReadonlySet<string>): void {
    if (!knownTypes.has(type)) return;
    this.counts.set(type, (this.counts.get(type) ?? 0) + 1);
    this.total++;
  }

  get blocksDestroyed(): number {
    return this.total;
  }

  /** Count for one type, or 0. */
  countOf(type: BlockType): number {
    return this.counts.get(type) ?? 0;
  }

  /** Immutable snapshot for HUD rendering (throttled readers, never live state). */
  getSnapshot(): StatsSnapshot {
    const byType: Record<string, number> = {};
    for (const [type, count] of this.counts) byType[type] = count;
    return { blocksDestroyed: this.total, byType };
  }

  /** Reset for a new run (§65 state transitions). */
  reset(): void {
    this.counts.clear();
    this.total = 0;
  }
}
