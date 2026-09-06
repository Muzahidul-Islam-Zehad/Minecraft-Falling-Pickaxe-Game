/**
 * Chunk data model (master spec §9).
 * Pure data + logic — no Phaser imports — so it is unit-testable in Node (§83).
 * Rendering/collision live in the Phaser host layer (§131 separation).
 */
import type { BlockType } from "@mef/config";

/** Chunk lifecycle (master spec §9). */
export type ChunkLifecycle = "GENERATING" | "VALIDATING" | "ACTIVE" | "RECYCLABLE" | "DISPOSED";

/** Per-cell record: flat arrays, no per-block objects (§8: avoid thousands of objects). */
export interface ChunkCell {
  /** Block type id; null = destroyed/empty cell. */
  type: BlockType | null;
  /** Current hit points (§12/§13). */
  hp: number;
  /** Maximum hit points for regen clamping (§14). */
  maxHp: number;
  /** Last damage timestamp in ms (chunk-relative clock); drives regen + crack refresh. */
  lastDamagedAt: number;
}

export interface ChunkData {
  /** Linear chunk index: 0, 1, 2, ... downward (positive = deeper). */
  readonly id: number;
  readonly lifecycle: ChunkLifecycle;
  /** Flat row-major grid [row * chunkWidth + col], length = width * height. */
  readonly cells: Array<ChunkCell | null>;
  readonly width: number;
  readonly height: number;
}

/** Options for creating chunk cell storage. */
export interface ChunkOptions {
  id: number;
  width: number;
  height: number;
}

/** Create an empty chunk shell in GENERATING state (§9 lifecycle start). */
export function createChunk(options: ChunkOptions): ChunkData {
  const cells: Array<ChunkCell | null> = new Array(options.width * options.height).fill(null);
  return { id: options.id, lifecycle: "GENERATING", cells, width: options.width, height: options.height };
}

/** Write a block into a cell (used by the generator). */
export function setCell(
  chunk: ChunkData,
  col: number,
  row: number,
  type: BlockType,
  hp: number,
): void {
  if (col < 0 || col >= chunk.width || row < 0 || row >= chunk.height) return; // §70 bounds
  chunk.cells[row * chunk.width + col] = { type, hp, maxHp: hp, lastDamagedAt: -Infinity };
}

/** Read a cell, or null when out of bounds/empty. */
export function getCell(chunk: ChunkData, col: number, row: number): ChunkCell | null {
  if (col < 0 || col >= chunk.width || row < 0 || row >= chunk.height) return null;
  return chunk.cells[row * chunk.width + col] ?? null;
}

/** Advance lifecycle (§9). Invalid transitions are refused, never silent. */
export function transitionChunk(chunk: ChunkData, to: ChunkLifecycle): boolean {
  const allowed: Record<ChunkLifecycle, readonly ChunkLifecycle[]> = {
    GENERATING: ["VALIDATING"],
    VALIDATING: ["ACTIVE", "GENERATING"], // failed validation → regenerate (§68/§69)
    ACTIVE: ["RECYCLABLE"],
    RECYCLABLE: ["DISPOSED"],
    DISPOSED: [],
  };
  if (!allowed[chunk.lifecycle].includes(to)) return false;
  (chunk as { lifecycle: ChunkLifecycle }).lifecycle = to;
  return true;
}

/** Crack stage 0..9 from remaining HP fraction (master spec §13). */
export function crackStage(cell: ChunkCell): number {
  if (cell.type === null) return 0;
  const fraction = cell.hp / cell.maxHp;
  if (fraction >= 1) return 0;
  // 1 HP left → stage 9; just-damaged → stage 1.
  const stage = Math.ceil((1 - fraction) * 10);
  return Math.min(9, Math.max(1, stage));
}

export interface DamageResult {
  destroyed: boolean;
  /** True if HP changed (damage or regen) and visuals must refresh. */
  changed: boolean;
  /** Crack stage after the change (0 = pristine). */
  crackStage: number;
}

/**
 * Apply damage to a cell (master spec §13/§18 flow steps 2-3).
 * @returns outcome; destroyed cells are nulled by the caller after reward/effects.
 */
export function applyDamage(cell: ChunkCell, amount: number, nowMs: number): DamageResult {
  if (cell.type === null || amount <= 0 || !Number.isFinite(amount)) {
    return { destroyed: false, changed: false, crackStage: crackStage(cell) };
  }
  cell.hp = Math.max(0, cell.hp - amount);
  cell.lastDamagedAt = nowMs;
  const destroyed = cell.hp <= 0;
  return { destroyed, changed: true, crackStage: destroyed ? 9 : crackStage(cell) };
}

/**
 * Timestamp-based regeneration (master spec §14): ~20% HP per interval, only after the
 * delay since last damage, and never for destroyed cells. Called once per chunk per frame —
 * NOT a timer per block (§14 explicitly forbids thousands of timer objects).
 * @returns true when HP changed and visuals must refresh.
 */
export function tickRegen(
  cell: ChunkCell,
  nowMs: number,
  delayMs: number,
  intervalMs: number,
  fraction: number,
): boolean {
  if (cell.type === null) return false;
  if (cell.hp >= cell.maxHp) return false;

  // A cell heals when enough time has passed since its last "event" (damage or heal):
  // at least the damage delay AND one regen interval. Healing bumps the event time so
  // successive heals are interval-spaced (§14: ~20% HP per interval after a delay).
  const eventAge = nowMs - cell.lastDamagedAt;
  if (eventAge < Math.max(delayMs, intervalMs)) return false;
  const heal = Math.max(1, Math.round(cell.maxHp * fraction));
  cell.hp = Math.min(cell.maxHp, cell.hp + heal);
  cell.lastDamagedAt = nowMs;
  return true;
}
