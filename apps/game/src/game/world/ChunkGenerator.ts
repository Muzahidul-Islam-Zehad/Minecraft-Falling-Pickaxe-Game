/**
 * Deterministic chunk generation (master spec §10, §11, §69).
 * chunkSeed = hash(runSeed, chunkId): same inputs always produce the same chunk.
 * Chunks are fully solid (every cell filled) — the ONE base pickaxe mines downward
 * through them. Fallback chunk (§69): mostly stone, limited ores, guaranteed valid.
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
   * Chunks above the world top (id < 0) are OPEN SKY: no blocks, no bodies. The ONE base
   * pickaxe starts in true open air, lands on the chunk-0 surface, and mines its own shaft
   * down (§16–§18, §23). Without this, any spawn/respawn would be wedged inside solid rock.
   */
  generateSky(chunkId: number): ChunkData {
    const chunk = createChunk({
      id: chunkId,
      width: this.config.chunkWidth,
      height: this.config.chunkHeight,
    });
    // All cells stay null (empty). Host activation creates the RenderTexture but no bodies.
    transitionChunk(chunk, "VALIDATING");
    return chunk;
  }

  /**
   * Normal deterministic generation (§10, §11): fully solid stone/dirt matrix with
   * rarity-weighted ore veins from the seeded stream.
   */
  generate(chunkId: number, runSeed: number): ChunkData {
    if (chunkId < 0) return this.generateSky(chunkId);
    const chunk = createChunk({
      id: chunkId,
      width: this.config.chunkWidth,
      height: this.config.chunkHeight,
    });
    const rng = new SeededRandom(deriveChunkSeed(runSeed, chunkId));

    for (let row = 0; row < this.config.chunkHeight; row++) {
      for (let col = 0; col < this.config.chunkWidth; col++) {
        let type: BlockType = rng.chance(0.85) ? "stone" : "dirt";
        if (rng.chance(0.1)) type = pickBlockType(rng);
        const def = BLOCK_BY_ID.get(type);
        if (def) setCell(chunk, col, row, type, def.hp);
      }
    }

    transitionChunk(chunk, "VALIDATING");
    return chunk;
  }

  /**
   * Safe fallback chunk (§69): mostly stone, limited coal/iron, deterministic fixed seed,
   * always valid — never lets procedural generation stop the game (§68).
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
