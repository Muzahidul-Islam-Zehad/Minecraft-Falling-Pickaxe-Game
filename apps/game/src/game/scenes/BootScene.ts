import Phaser from "phaser";

/**
 * BootScene (master spec §130): minimal entry scene.
 * Proves the engine boots, then hands off to Preload. Real assets/atlases arrive in Phase 3+.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const ctx = this.registry.get("context") as
      | { stateMachine: { transition: (s: string) => boolean } }
      | undefined;

    // BOOT -> LOADING (master spec §65)
    ctx?.stateMachine.transition("LOADING");
    this.scene.start("Preload");
  }
}
