/**
 * Deterministic chunk generation (master spec §10, §11, §69).
 * chunkSeed = hash(runSeed, chunkId): same inputs always produce the same chunk.
 * Fallback chunk (§69): mostly stone, limited ores, guaranteed valid geometry.
 */
import {
  BLOCK_BY_ID,
  BLOCK_DEFINITIONS,
  type BlockDefinition,
  type BlockType,
  type GameConfig,
} from "@mef/config";
import { SeededRandom, deriveChunkSeed } from "./SeededRandom";
import { createChunk, setCell, transitionChunk, type ChunkData } from "./Chunk";

/** Rarity-weighted pool of generatable block types (rarity 0 = never generated naturally). */
const GENERATABLE: readonly BlockDefinition[] = BLOCK_DEFINITIONS.filter((b) => b.rarity > 0);

const TOTAL_RARITY: number = GENERATABLE.reduce((sum, b) => sum + b.rarity, 0);

/** Pick a block type via rarity weights from a seeded RNG stream. */
function pickBlockType(rng: SeededRandom): BlockType {
  let roll = rng.next() * TOTAL_RARITY;
  for (const def of GENERATABLE) {
    roll -= def.rarity;
    if (roll < 0) return def.id;
  }
  return GENERATABLE[GENERATABLE.length - 1]!.id;
}

export class ChunkGenerator {
  constructor(private readonly config: GameConfig) {}

  /**
   * Normal deterministic generation (§10, §11).
   * The chunk is a stone matrix with rarity-weighted ore veins placed from the seeded stream.
   */
  generate(chunkId: number, runSeed: number): ChunkData {
    const chunk = createChunk({
      id: chunkId,
      width: this.config.chunkWidth,
      height: this.config.chunkHeight,
    });
    const rng = new SeededRandom(deriveChunkSeed(runSeed, chunkId));

    for (let row = 0; row < this.config.chunkHeight; row++) {
      for (let col = 0; col < this.config.chunkWidth; col++) {
        // Base terrain: mostly stone, some dirt pockets.
        let type: BlockType = rng.chance(0.85) ? "stone" : "dirt";
        // Vein chance: ~10% of cells start a small vein of something more interesting.
        if (rng.chance(0.1)) {
          type = pickBlockType(rng);
        }
        const def = BLOCK_BY_ID.get(type);
        if (def) setCell(chunk, col, row, type, def.hp);
      }
    }

    transitionChunk(chunk, "VALIDATING");
    return chunk;
  }

  /**
   * Safe fallback chunk (§69): mostly stone, limited coal/iron, no special obstacles,
   * deterministic via a fixed seed so it is always identical and always valid.
   */
  generateFallback(chunkId: number): ChunkData {
    const chunk = createChunk({
      id: chunkId,
      width: this.config.chunkWidth,
      height: this.config.chunkHeight,
    });
    const rng = new SeededRandom(deriveChunkSeed(0xc0ffee, chunkId));

    for (let row = 0; row < this.config.chunkHeight; row++) {
      for (let col = 0; col < this.config.chunkWidth; col++) {
        const type: BlockType = rng.chance(0.15) ? (rng.chance(0.5) ? "coal" : "iron") : "stone";
        const def = BLOCK_BY_ID.get(type);
        if (def) setCell(chunk, col, row, type, def.hp);
      }
    }

    transitionChunk(chunk, "VALIDATING");
    return chunk;
  }
}
