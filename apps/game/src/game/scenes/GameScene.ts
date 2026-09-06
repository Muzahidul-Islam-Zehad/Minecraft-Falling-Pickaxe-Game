import Phaser from "phaser";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { ChunkManager } from "../world/ChunkManager";
import { PhaserChunkHost } from "../world/PhaserChunkHost";
import { PickaxeManager } from "../entities/PickaxeManager";
import { CameraController } from "../CameraController";
import { StatsTracker } from "../systems/StatsTracker";
import { BLOCK_DEFINITIONS } from "@mef/config";

/** Valid block ids for stats attribution (catalog-bounded, §19): built once. */
const KNOWN_BLOCK_TYPES: ReadonlySet<string> = new Set(BLOCK_DEFINITIONS.map((b) => b.id));
import type { GameConfig } from "@mef/config";
import type { GameStateMachine } from "../systems/GameStateMachine";
import type { MetricsTracker } from "../systems/MetricsTracker";

export interface GameContext {
  config: GameConfig;
  stateMachine: GameStateMachine;
  metrics: MetricsTracker;
  /** Monotonic game clock (ms) for regen/damage timestamps (§14, §120). */
  nowMs: number;
}

/** Registry keys the UI/debug overlay read. */
export const WORLD_INFO_KEYS = {
  distance: "world.distance",
  chunkCount: "world.chunkCount",
  runSeed: "world.runSeed",
  pickaxes: "world.pickaxes",
  textures: "world.textures",
  hudStats: "world.hudStats",
} as const;

/** Horizontal offset centering the world inside the canvas. */
export function worldOffsetX(config: GameConfig): number {
  return Math.floor((config.width - config.chunkWidth * config.blockSizePx) / 2);
}

/**
 * GameScene (master spec §130): owns the world and the ONE base pickaxe.
 * The camera follows the pickaxe (§22) with smoothing + lookahead; the pickaxe falls
 * forever and continuously mines what it presses against (§16–§18). Dev-only tap mining
 * remains for debugging (§137).
 */
export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private cameraController!: CameraController;
  private chunkManager!: ChunkManager;
  private chunkHost!: PhaserChunkHost;
  private pickaxeManager!: PickaxeManager;
  private stats!: StatsTracker;
  private readonly devTapEnabled = import.meta.env.DEV;

  constructor() {
    super("Game");
  }

  create(): void {
    this.ctx = this.registry.get("context") as GameContext;

    this.cameras.main.setBackgroundColor("#0d0d12");
    this.cameraController = new CameraController(this.cameras.main, this.ctx.config);
    this.registry.set("cameraController", this.cameraController);

    // World setup (§10, §112): seed logged in dev for bug reproduction (§113).
    const runSeed = (Date.now() ^ (Math.floor(Math.random() * 0xffff) << 16)) >>> 0;
     
    console.info(`[game] runSeed=${runSeed}`);
    const generator = new ChunkGenerator(this.ctx.config);
    const offsetX = worldOffsetX(this.ctx.config);
    this.chunkHost = new PhaserChunkHost(this, this.ctx.config, offsetX);
    this.chunkManager = new ChunkManager(this.ctx.config, generator, {
      onChunkActivated: (chunk) => this.chunkHost.onChunkActivated(chunk),
      onChunkRecycled: (chunk) => this.chunkHost.onChunkRecycled(chunk),
      onCellChanged: (chunk, col, row, result) => this.chunkHost.onCellChanged(chunk, col, row, result),
      onGenerationError: (chunkId, error) =>
         
        console.warn(`[world] chunk ${chunkId} generation failed, using fallback`, error),
      onBlockDestroyed: (type) => this.stats.recordDestroyed(type, KNOWN_BLOCK_TYPES),
    });
    this.chunkManager.setRunSeed(runSeed);
    this.registry.set("chunkManager", this.chunkManager);
    this.registry.set("world.offsetX", offsetX);

    // §24 rewards: destroyed-block stats flow world → tracker → HUD via the registry.
    this.stats = new StatsTracker();
    this.registry.set("statsTracker", this.stats);

    // THE base pickaxe (§16): one entity, camera follows it, it mines (§18).
    this.pickaxeManager = new PickaxeManager(
      this,
      this.ctx.config,
      this.chunkManager,
      this.chunkHost.blockBodies,
      () => this.ctx.nowMs,
    );
    this.pickaxeManager.ensureBase();

    // READY -> RUNNING (master spec §65).
    this.ctx.stateMachine.transition("RUNNING");

    // §137: dev-only tap mining — tap a block to deal 10 HP damage.
    if (this.devTapEnabled) {
      this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        const col = Math.floor((pointer.worldX - offsetX) / this.ctx.config.blockSizePx);
        const worldRow = Math.floor(pointer.worldY / this.ctx.config.blockSizePx);
        const chunkId = Math.floor(worldRow / this.ctx.config.chunkHeight);
        const row =
          ((worldRow % this.ctx.config.chunkHeight) + this.ctx.config.chunkHeight) % this.ctx.config.chunkHeight;
        this.chunkManager.damageCell(chunkId, col, row, 10, this.ctx.nowMs);
      });
    }

    // §128: clear registry references and entity systems on shutdown.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pickaxeManager.destroy();
      this.registry.remove("cameraController");
      this.registry.remove("chunkManager");
      this.registry.remove("world.offsetX");
      this.registry.remove("statsTracker");
      this.registry.remove(WORLD_INFO_KEYS.hudStats);
    });
  }

  override update(_time: number, delta: number): void {
    // Shared game clock; delta capped ONCE here so tab-switches cause neither regen
    // bursts nor pickaxe/camera spikes (§70).
    this.ctx.nowMs += Math.min(delta, 100);
    const clampedDelta = Math.min(delta, 100);

    // Base pickaxe: physics caps, continuous mining, respawn guard (§17, §18, §70).
    this.pickaxeManager.update(clampedDelta);

    // Camera follows the base pickaxe (§22): ALL movement routes through the
    // controller. Downward ratchet (user spec): hold until the pickaxe digs past the
    // screen middle, then ease to keep it at the middle — never scrolls up, so strike
    // hops/rebounds cannot jitter the view. The pure pickaxe Y is used (no lookahead —
    // lookahead is only for chunk streaming ahead, §21). Shake stays budgeted.
    const camFocusY = this.pickaxeManager.getCameraFocusY();
    this.cameraController.followDown(camFocusY, clampedDelta, this.ctx.config.height);
    const cam = this.cameras.main;
    // Keep the world column centered horizontally (§7).
    const worldCenterX = worldOffsetX(this.ctx.config) + (this.ctx.config.chunkWidth * this.ctx.config.blockSizePx) / 2;
    cam.scrollX = worldCenterX - this.ctx.config.width / 2;

    // Chunks stream beneath the pickaxe (§21, §77): the streaming focus keeps the
    // lookahead (generate slightly AHEAD of the descent); the camera ratchet does not.
    const streamFocus = this.pickaxeManager.getFocusPoint();
    this.chunkManager.update(this.ctx.nowMs, streamFocus.y, this.ctx.config.blockSizePx);
    this.ctx.metrics.sample(clampedDelta);

    // §24 HUD depth = the pickaxe's REAL position (the streaming focus includes a
    // 140px lookahead and would overstate depth by ~4 blocks).
    this.registry.set(WORLD_INFO_KEYS.distance, Math.max(0, Math.floor(camFocusY)));
    this.registry.set(WORLD_INFO_KEYS.chunkCount, this.chunkManager.activeCount);
    this.registry.set(WORLD_INFO_KEYS.runSeed, this.chunkManager.runSeed);
    this.registry.set(WORLD_INFO_KEYS.pickaxes, this.pickaxeManager.activeCount);
    this.registry.set(WORLD_INFO_KEYS.textures, this.chunkHost.stats.textures);
    // §24 HUD stats: throttled snapshot copy — the HUD never touches live state.
    this.registry.set(WORLD_INFO_KEYS.hudStats, this.stats.getSnapshot());
  }
}
