import Phaser from "phaser";
import { generateWorldTextures } from "../world/blockTextures";
import type { GameContext } from "./GameScene";

/**
 * PreloadScene (master spec §130).
 * Generates ALL placeholder textures ONCE at startup — never per frame (§73) —
 * then launches the game + UI scenes in parallel. External assets arrive in later phases
 * (§100: original assets only).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  create(): void {
    const ctx = this.registry.get("context") as GameContext;

    // Generic white pixel for tinting/bodies.
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture("white", 8, 8);
    g.destroy();

    // All block + crack textures (§12, §13): one-time, deterministic.
    generateWorldTextures(this, ctx.config.blockSizePx);

    // LOADING -> READY (master spec §65); GameScene flips READY -> RUNNING.
    ctx.stateMachine.transition("READY");

    this.scene.launch("Game");
    this.scene.launch("Ui");
    this.scene.stop("Preload");
  }
}
