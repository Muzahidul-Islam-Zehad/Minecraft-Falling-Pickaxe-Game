/**
 * Phaser host for the ChunkManager (§131 separation): rendering + physics only.
 * - One pooled RenderTexture per chunk instead of thousands of sprites (§8, §20)
 * - Simple static rectangle bodies per solid cell (§15, §133)
 * - Crack overlays are pooled images above the chunk texture (§13, §20)
 * - All body/texture cleanup happens on recycle (§75)
 */
import Phaser from "phaser";
import { BLOCK_BY_ID, type GameConfig } from "@mef/config";
import type { ChunkData, DamageResult } from "./Chunk";
import type { ChunkHost } from "./ChunkManager";

interface CellVisual {
  body: Phaser.Physics.Arcade.Image;
  textureKey: string;
  crack?: Phaser.GameObjects.Image;
}

export class PhaserChunkHost implements ChunkHost {
  private readonly chunkWidthPx: number;
  private readonly chunkHeightPx: number;

  /** Chunk id → RenderTexture (pooled, one per active chunk). */
  private readonly textures = new Map<number, Phaser.GameObjects.RenderTexture>();
  /** Chunk id → per-cell visuals (bodies + crack overlays). */
  private readonly cellVisuals = new Map<number, Map<number, CellVisual>>();
  /** Crack overlay pool (§20: acquire/release, never new/destroy per hit). */
  private readonly crackPool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GameConfig,
    private readonly offsetX = 0,
  ) {
    this.chunkWidthPx = config.chunkWidth * config.blockSizePx;
    this.chunkHeightPx = config.chunkHeight * config.blockSizePx;

    scene.physics.add.staticGroup();
  }

  get stats(): { textures: number; crackPoolSize: number; cracksInUse: number } {
    let cracksInUse = 0;
    for (const cells of this.cellVisuals.values()) {
      for (const v of cells.values()) if (v.crack) cracksInUse++;
    }
    return { textures: this.textures.size, crackPoolSize: this.crackPool.length, cracksInUse };
  }

  onChunkActivated(chunk: ChunkData): void {
    const rt = this.scene.add
      .renderTexture(0, chunk.id * this.chunkHeightPx, this.chunkWidthPx, this.chunkHeightPx)
      .setOrigin(0, 0)
      .setDepth(5);
    this.textures.set(chunk.id, rt);

    const cells = new Map<number, CellVisual>();
    this.cellVisuals.set(chunk.id, cells);

    for (let row = 0; row < chunk.height; row++) {
      for (let col = 0; col < chunk.width; col++) {
        const cell = chunk.cells[row * chunk.width + col];
        if (!cell || cell.type === null) continue;
        const def = BLOCK_BY_ID.get(cell.type);
        if (!def) continue; // §136: unknown type would be a validation failure

        const cx = this.offsetX + col * this.config.blockSizePx + this.config.blockSizePx / 2;
        const cy = chunk.id * this.chunkHeightPx + row * this.config.blockSizePx + this.config.blockSizePx / 2;

        rt.draw(def.textureKey, cx, cy);

        // Invisible static image = cheap simple rectangle body (§15, §133).
        const body = this.scene.physics.add
          .staticImage(cx, cy, "white")
          .setDisplaySize(this.config.blockSizePx, this.config.blockSizePx)
          .setVisible(false);
        body.refreshBody();
        cells.set(row * chunk.width + col, { body, textureKey: def.textureKey });
      }
    }
  }

  onChunkRecycled(chunk: ChunkData): void {
    this.textures.get(chunk.id)?.destroy();
    this.textures.delete(chunk.id);

    const cells = this.cellVisuals.get(chunk.id);
    if (cells) {
      for (const visual of cells.values()) {
        visual.body.destroy();
        if (visual.crack) this.releaseCrack(visual.crack);
      }
      this.cellVisuals.delete(chunk.id);
    }
  }

  onCellChanged(chunk: ChunkData, col: number, row: number, result: DamageResult): void {
    const rt = this.textures.get(chunk.id);
    const cells = this.cellVisuals.get(chunk.id);
    if (!rt || !cells) return;

    const idx = row * chunk.width + col;
    const visual = cells.get(idx);
    const x = this.offsetX + col * this.config.blockSizePx + this.config.blockSizePx / 2;
    const y = chunk.id * this.chunkHeightPx + row * this.config.blockSizePx + this.config.blockSizePx / 2;

    if (result.destroyed) {
      // Erase the block's pixels from the chunk texture (all block textures are opaque 32×32).
      const eraseKey = visual?.textureKey ?? "block-stone";
      rt.erase(eraseKey, x, y);
      if (visual) {
        visual.body.destroy();
        if (visual.crack) {
          this.releaseCrack(visual.crack);
          visual.crack = undefined;
        }
        cells.delete(idx);
      }
      return;
    }

    if (!visual) return; // healed cell with no visuals: nothing to refresh

    // Refresh crack overlay from the pool (§13: pre-baked frames, never generated per frame).
    if (visual.crack) this.releaseCrack(visual.crack);
    if (result.crackStage > 0) {
      const crack = this.acquireCrack();
      crack.setTexture(`crack-${result.crackStage}`);
      crack.setPosition(x, y);
      crack.setVisible(true);
      visual.crack = crack;
    } else {
      visual.crack = undefined;
    }
  }

  private acquireCrack(): Phaser.GameObjects.Image {
    const pooled = this.crackPool.pop();
    if (pooled) return pooled;
    return this.scene.add
      .image(0, 0, "crack-1")
      .setDepth(6)
      .setVisible(false);
  }

  private releaseCrack(crack: Phaser.GameObjects.Image): void {
    crack.setVisible(false);
    this.crackPool.push(crack);
  }
}
