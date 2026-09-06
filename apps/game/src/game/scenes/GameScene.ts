import Phaser from "phaser";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { ChunkManager } from "../world/ChunkManager";
import { PhaserChunkHost } from "../world/PhaserChunkHost";
import { CameraController } from "../CameraController";
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
} as const;

/** Horizontal offset centering the world inside the canvas. */
export function worldOffsetX(config: GameConfig): number {
  return Math.floor((config.width - config.chunkWidth * config.blockSizePx) / 2);
}

/**
 * GameScene (master spec §130): owns the world. Phase 3 scope:
 * deterministic chunked world with recycling, block HP/cracks/regen, static bodies,
 * auto-descent (§114: game progresses without chat), dev-only tap mining (§137).
 * Pickaxes/TNT arrive in Phase 4/7 — this scene's job is the world beneath them.
 */
export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private cameraController!: CameraController;
  private chunkManager!: ChunkManager;
  private chunkHost!: PhaserChunkHost;
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
    });
    this.chunkManager.setRunSeed(runSeed);
    this.registry.set("chunkManager", this.chunkManager);

    // READY -> RUNNING (master spec §65).
    this.ctx.stateMachine.transition("RUNNING");

    // §137: dev-only tap mining — tap a block to deal 10 HP damage.
    if (this.devTapEnabled) {
      this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        const col = Math.floor((pointer.worldX - offsetX) / this.ctx.config.blockSizePx);
        const worldRow = Math.floor(pointer.worldY / this.ctx.config.blockSizePx);
        const chunkId = Math.floor(worldRow / this.ctx.config.chunkHeight);
        const row = ((worldRow % this.ctx.config.chunkHeight) + this.ctx.config.chunkHeight) % this.ctx.config.chunkHeight;
        this.chunkManager.damageCell(chunkId, col, row, 10, this.ctx.nowMs);
      });
    }

    // §128: clear registry references on shutdown.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.remove("cameraController");
      this.registry.remove("chunkManager");
    });
  }

  override update(_time: number, delta: number): void {
    // Shared game clock; delta capped so tab-switches don't cause regen bursts (§70).
    this.ctx.nowMs += Math.min(delta, 100);

    // §114: autonomous descent ~120 px/s — gameplay progresses with zero chat activity.
    this.cameras.main.scrollY += 0.12 * delta;

    const focusY = this.cameras.main.scrollY + this.ctx.config.height * 0.5;
    this.chunkManager.update(this.ctx.nowMs, focusY, this.ctx.config.blockSizePx);
    this.ctx.metrics.sample(delta);

    this.registry.set(WORLD_INFO_KEYS.distance, Math.floor(this.cameras.main.scrollY));
    this.registry.set(WORLD_INFO_KEYS.chunkCount, this.chunkManager.activeCount);
    this.registry.set(WORLD_INFO_KEYS.runSeed, this.chunkManager.runSeed);
  }
}
