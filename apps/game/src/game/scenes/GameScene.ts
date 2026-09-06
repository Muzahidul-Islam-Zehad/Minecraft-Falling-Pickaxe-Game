import Phaser from "phaser";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { ChunkManager } from "../world/ChunkManager";
import { PhaserChunkHost } from "../world/PhaserChunkHost";
import { PickaxeManager } from "../entities/PickaxeManager";
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
  pickaxes: "world.pickaxes",
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
    // eslint-disable-next-line no-console
    console.info(`[game] runSeed=${runSeed}`);
    const generator = new ChunkGenerator(this.ctx.config);
    const offsetX = worldOffsetX(this.ctx.config);
    this.chunkHost = new PhaserChunkHost(this, this.ctx.config, offsetX);
    this.chunkManager = new ChunkManager(this.ctx.config, generator, {
      onChunkActivated: (chunk) => this.chunkHost.onChunkActivated(chunk),
      onChunkRecycled: (chunk) => this.chunkHost.onChunkRecycled(chunk),
      onCellChanged: (chunk, col, row, result) => this.chunkHost.onCellChanged(chunk, col, row, result),
      onGenerationError: (chunkId, error) =>
        // eslint-disable-next-line no-console
        console.warn(`[world] chunk ${chunkId} generation failed, using fallback`, error),
    });
    this.chunkManager.setRunSeed(runSeed);
    this.registry.set("chunkManager", this.chunkManager);
    this.registry.set("world.offsetX", offsetX);

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
    });
  }

  override update(_time: number, delta: number): void {
    // Shared game clock; delta capped so tab-switches don't cause regen bursts (§70).
    this.ctx.nowMs += Math.min(delta, 100);

    // Base pickaxe: physics caps, continuous mining, respawn guard (§17, §18, §70).
    this.pickaxeManager.update(delta);

    // Camera follows the base pickaxe (§22): smoothing + lookahead, no jitter.
    const focus = this.pickaxeManager.getFocusPoint();
    const cam = this.cameras.main;
    const targetScrollY = focus.y - this.ctx.config.height * 0.4;
    const lerpFactor = Math.min(1, (delta / 1000) * 5);
    cam.scrollY += (targetScrollY - cam.scrollY) * lerpFactor;
    // Keep the world column centered horizontally (§7).
    const worldCenterX = worldOffsetX(this.ctx.config) + (this.ctx.config.chunkWidth * this.ctx.config.blockSizePx) / 2;
    cam.scrollX = worldCenterX - this.ctx.config.width / 2;

    // Chunks stream beneath the pickaxe (§21, §77): window centered on the pickaxe.
    this.chunkManager.update(this.ctx.nowMs, focus.y, this.ctx.config.blockSizePx);
    this.ctx.metrics.sample(delta);

    this.registry.set(WORLD_INFO_KEYS.distance, Math.max(0, Math.floor(focus.y)));
    this.registry.set(WORLD_INFO_KEYS.chunkCount, this.chunkManager.activeCount);
    this.registry.set(WORLD_INFO_KEYS.runSeed, this.chunkManager.runSeed);
    this.registry.set(WORLD_INFO_KEYS.pickaxes, this.pickaxeManager.activeCount);
  }
}
