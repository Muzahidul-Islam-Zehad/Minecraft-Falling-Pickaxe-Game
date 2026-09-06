import Phaser from "phaser";
import { generateWorldTextures } from "../world/blockTextures";
import { generatePickaxeTextures } from "../world/pickaxeTextures";
import { generateTntTextures } from "../world/tntTextures";
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

    // Generic white pixel for tinting/bodies. Guarded: if preload ever re-runs
    // (scene restart, HMR, §68 robustness), don't collide with existing textures.
    if (!this.textures.exists("white")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 8, 8);
      g.generateTexture("white", 8, 8);
      g.destroy();
    }

    // All block + crack + pickaxe + TNT textures (§12, §13, §16, §73): one-time, deterministic.
    generateWorldTextures(this, ctx.config.blockSizePx);
    generatePickaxeTextures(this, Math.round(ctx.config.blockSizePx * 0.875));
    generateTntTextures(this, ctx.config.blockSizePx);

    // LOADING -> READY (master spec §65); GameScene flips READY -> RUNNING.
    ctx.stateMachine.transition("READY");

    this.scene.launch("Game");
    this.scene.launch("Ui");
    this.scene.stop("Preload");
  }
}
