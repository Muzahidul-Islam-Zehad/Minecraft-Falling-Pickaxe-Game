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
  /** Static group holding ALL block bodies — collider target for dynamic entities (§15). */
  readonly blockBodies: Phaser.Physics.Arcade.StaticGroup;

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
    this.blockBodies = scene.physics.add.staticGroup();
  }

  get stats(): { textures: number; crackPoolSize: number; cracksInUse: number } {
    let cracksInUse = 0;
    for (const cells of this.cellVisuals.values()) {
      for (const v of cells.values()) if (v.crack) cracksInUse++;
    }
    return { textures: this.textures.size, crackPoolSize: this.crackPool.length, cracksInUse };
  }

  onChunkActivated(chunk: ChunkData): void {
    // RT origin (top-left) sits at the chunk's WORLD position: x = offsetX (centered
    // world column), y = chunkId * chunkHeightPx. Chunk-local draw coords inside it then
    // line up exactly with the world-coordinate bodies/cracks/pickaxe.
    const rt = this.scene.add
      .renderTexture(this.offsetX, chunk.id * this.chunkHeightPx, this.chunkWidthPx, this.chunkHeightPx)
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

        // Bodies live in WORLD coordinates (same space as the pickaxe and camera):
        // X includes the horizontal world offset, Y includes the chunk's world offset.
        // (Chunk-local coords here = invisible bodies stacked at the top of the world,
        // while the visible texture sits at the chunk — the "spinning on air" bug.)
        const cx = this.offsetX + col * this.config.blockSizePx + this.config.blockSizePx / 2;
        const cy = chunk.id * this.chunkHeightPx + row * this.config.blockSizePx + this.config.blockSizePx / 2;

        // RT draw coordinates stay chunk-LOCAL. draw() places the texture's TOP-LEFT at
        // (x, y) (verified: context.drawImage semantics), so blocks draw at the cell's
        // top-left corner — a half-block offset here clipped the last row (half rows) and
        // shifted every next chunk down (the boundary gap).
        rt.draw(def.textureKey, col * this.config.blockSizePx, row * this.config.blockSizePx);

        // Invisible static rectangle body in the shared static group (§15, §133).
        const bodyImg = this.blockBodies.create(cx, cy, "white") as Phaser.Physics.Arcade.Image;
        bodyImg.setVisible(false).setDisplaySize(this.config.blockSizePx, this.config.blockSizePx);
        bodyImg.refreshBody();
        cells.set(row * chunk.width + col, { body: bodyImg, textureKey: def.textureKey });
      }
    }
  }

  onChunkRecycled(chunk: ChunkData): void {
    this.textures.get(chunk.id)?.destroy();
    this.textures.delete(chunk.id);

    const cells = this.cellVisuals.get(chunk.id);
    if (cells) {
      for (const visual of cells.values()) {
        this.blockBodies.remove(visual.body, true, true); // destroy from group + scene (§75)
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
    // World coordinates for scene objects (bodies, crack overlays — these are
    // origin-0.5 images, so center coords are correct for them).
    const x = this.offsetX + col * this.config.blockSizePx + this.config.blockSizePx / 2;
    const y = chunk.id * this.chunkHeightPx + row * this.config.blockSizePx + this.config.blockSizePx / 2;
    // RT-local TOP-LEFT corner for draw/erase — same convention as draw() above.
    const localX = col * this.config.blockSizePx;
    const localY = row * this.config.blockSizePx;

    if (result.destroyed) {
      // Erase the block's pixels from the chunk texture (all block textures are opaque 32×32).
      const eraseKey = visual?.textureKey ?? "block-stone";
      rt.erase(eraseKey, localX, localY);
      if (visual) {
        this.blockBodies.remove(visual.body, true, true);
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
