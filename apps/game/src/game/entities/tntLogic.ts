/**
 * Pure TNT/explosion helpers (master spec §25–§29).
 * No Phaser — unit-testable in Node (§83). The Phaser manager applies these.
 */
import type { TntKind } from "@mef/config";

/** TNT lifecycle (master spec §25): strict order, no skipping. */
export type TntLifecycle = "CREATED" | "ARMED" | "FALLING" | "TRIGGERED" | "EXPLODING" | "DONE";

const LEGAL: Record<TntLifecycle, readonly TntLifecycle[]> = {
  CREATED: ["ARMED"],
  ARMED: ["FALLING"],
  FALLING: ["TRIGGERED"],
  TRIGGERED: ["EXPLODING"],
  EXPLODING: ["DONE"],
  DONE: [],
};

/** Attempt a lifecycle transition; illegal moves are refused (§25: no skipping states). */
export function transitionTnt(entity: { lifecycle: TntLifecycle }, to: TntLifecycle): boolean {
  if (!LEGAL[entity.lifecycle].includes(to)) return false;
  (entity as { lifecycle: TntLifecycle }).lifecycle = to;
  return true;
}

/**
 * Sanitize a viewer name for display (§26): strip control/HTML-significant characters,
 * collapse whitespace, clamp length. Output is plain text safe for Phaser text rendering —
 * usernames must never be able to form markup, commands, or code.
 */
export function sanitizeOwnerName(raw: string, maxChars: number): string {
  const cleaned = raw
    // Remove control chars and anything HTML-significant outright.
    .replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return "???";
  return cleaned.length <= maxChars ? cleaned : `${cleaned.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** Which TNT kind a NUKE burst spawns at a given burst index (alternating tnt/mega, §30). */
export function nukeBurstKind(index: number): Extract<TntKind, "tnt" | "mega"> {
  return index % 2 === 0 ? "tnt" : "mega";
}

/** Result of sampling one cell against an explosion (§27). */
export interface ExplosionSample {
  readonly col: number;
  readonly row: number;
  /** Damage with distance falloff applied, rounded; ≥ 1 while inside the radius. */
  readonly damage: number;
}

/**
 * Select the cells an explosion damages (§27: radius + falloff + SPATIAL FILTER —
 * only the cells inside the circle inside the given bounds are produced; the world is
 * never scanned). Falloff is linear from center (full damage) to the rim (≥ 1).
 * Center may be outside the bounds; out-of-bounds cells are skipped.
 */
export function explosionCells(params: {
  centerX: number;
  centerY: number;
  radiusPx: number;
  maxDamage: number;
  blockSizePx: number;
  /** Chunk-cell bounds of the inspection area (spatial filter, §27). */
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  /** Map one row to its chunk id (keeps this pure — the manager supplies the rule). */
  chunkIdForRow: (row: number, rowsPerChunk: number) => number;
  rowsPerChunk: number;
}): Array<{ chunkId: number; col: number; row: number; damage: number }> {
  const { centerX, centerY, radiusPx, maxDamage, blockSizePx, rowsPerChunk } = params;
  const out: Array<{ chunkId: number; col: number; row: number; damage: number }> = [];
  const minCol = Math.max(params.minCol, Math.floor((centerX - radiusPx) / blockSizePx));
  const maxCol = Math.min(params.maxCol, Math.ceil((centerX + radiusPx) / blockSizePx));
  const minRow = Math.max(params.minRow, Math.floor((centerY - radiusPx) / blockSizePx));
  const maxRow = Math.min(params.maxRow, Math.ceil((centerY + radiusPx) / blockSizePx));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      // Cell center distance vs radius (circle, not square — §27 radius semantics).
      const dx = (col + 0.5) * blockSizePx - centerX;
      const dy = (row + 0.5) * blockSizePx - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radiusPx) continue;
      // Linear falloff: center → full damage, rim → 1 (never 0: a hit is a hit).
      const falloff = 1 - dist / (radiusPx + 0.0001);
      const damage = Math.max(1, Math.round(maxDamage * falloff));
      out.push({
        chunkId: params.chunkIdForRow(row, rowsPerChunk),
        col,
        row,
        damage,
      });
    }
  }
  // Sanity: bounded output even if callers pass absurd radii (§27 "bounded").
  const maxCells = (maxCol - minCol + 1) * (maxRow - minRow + 1);
  return maxCells > 0 ? out.slice(0, maxCells) : out;
}
