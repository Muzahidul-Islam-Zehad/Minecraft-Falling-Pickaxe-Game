import Phaser from "phaser";
import { CameraController } from "../CameraController";
import type { GameConfig } from "@mef/config";
import type { GameStateMachine } from "../systems/GameStateMachine";
import type { MetricsTracker } from "../systems/MetricsTracker";

export interface GameContext {
  config: GameConfig;
  stateMachine: GameStateMachine;
  metrics: MetricsTracker;
}

/**
 * GameScene (master spec §130): gameplay world lives here from Phase 3 onward.
 * Phase 2 proves: the loop runs, per-frame work is bounded and allocation-free (§77),
 * the camera is budget-controlled (§22), and metrics are sampled (§96).
 */
export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private background!: Phaser.GameObjects.TileSprite;
  private cameraController!: CameraController;

  constructor() {
    super("Game");
  }

  create(): void {
    this.ctx = this.registry.get("context") as GameContext;

    this.cameras.main.setBackgroundColor("#0d0d12");
    this.background = this.add
      .tileSprite(0, 0, this.ctx.config.width, this.ctx.config.height, "demo-block")
      .setOrigin(0);

    this.cameraController = new CameraController(this.cameras.main, this.ctx.config);
    this.registry.set("cameraController", this.cameraController);

    // READY -> RUNNING (master spec §65)
    this.ctx.stateMachine.transition("RUNNING");

    // §128: clear registry reference on shutdown to avoid stale handlers.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.remove("cameraController");
    });
  }

  override update(_time: number, delta: number): void {
    // Falling illusion: scroll the tiled background. Bounded, allocation-free per-frame work.
    this.background.tilePositionY -= 0.08 * delta;
    this.ctx.metrics.sample(delta);
  }
}
