import Phaser from "phaser";

/**
 * PreloadScene (master spec §130).
 * Phase 2 has no external assets yet (§100: original assets only), so this scene generates
 * tiny placeholder textures ONCE at startup — never per frame (§73) — then launches the
 * game + UI scenes in parallel.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  create(): void {
    this.generatePlaceholderTextures();

    const ctx = this.registry.get("context") as
      | { stateMachine: { transition: (s: string) => boolean } }
      | undefined;
    // LOADING -> READY (master spec §65); GameScene flips READY -> RUNNING.
    ctx?.stateMachine.transition("READY");

    this.scene.launch("Game");
    this.scene.launch("Ui");
    this.scene.stop("Preload");
  }

  private generatePlaceholderTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Generic white pixel for effects/tinting later.
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture("white", 8, 8);

    // Simple dark block tile for the loop-proof background.
    g.clear();
    g.fillStyle(0x23232b, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x2c2c36, 1);
    g.fillRect(0, 0, 32, 2);
    g.fillRect(0, 0, 2, 32);
    g.fillStyle(0x383844, 1);
    g.fillRect(4, 4, 3, 3);
    g.fillRect(21, 13, 3, 3);
    g.fillRect(11, 25, 3, 3);
    g.generateTexture("demo-block", 32, 32);

    g.destroy();
  }
}
