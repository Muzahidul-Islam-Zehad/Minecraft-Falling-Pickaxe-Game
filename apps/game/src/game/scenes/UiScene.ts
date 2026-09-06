import Phaser from "phaser";
import type { GameContext } from "./GameScene";
import { DebugOverlay } from "../../ui/DebugOverlay";

const UI_REFRESH_MS = 250;

/**
 * UiScene (master spec §130, §24): fixed UI layer, lightweight Phaser text only — never DOM (§78).
 * Shows the game title and throttled FPS readout during development; the real HUD arrives in Phase 6.
 * Also handles orientation hints for the portrait target (§7, §90).
 *
 * Orientation policy (Phase 2): landscape shows a "rotate device" hint but does not pause.
 * Gameplay pause-on-orientation is deferred to Phase 3 when pause semantics exist (§110).
 */
export class UiScene extends Phaser.Scene {
  private ctx!: GameContext;
  private fpsText!: Phaser.GameObjects.Text;
  private orientationHint!: Phaser.GameObjects.Text;
  private debugOverlay: DebugOverlay | null = null;
  private acc = 0;

  constructor() {
    super("Ui");
  }

  create(): void {
    this.ctx = this.registry.get("context") as GameContext;

    this.add
      .text(12, 10, "MINECRAFT ENDLESS FALL", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#cfd8dc",
      })
      .setDepth(10);

    this.fpsText = this.add
      .text(12, 32, "FPS -", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#9fb4c7",
      })
      .setDepth(10);

    this.orientationHint = this.add
      .text(this.ctx.config.width / 2, this.ctx.config.height / 2, "Rotate your device\nfor portrait view", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        align: "center",
        backgroundColor: "#000000cc",
        padding: { x: 16, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setVisible(false);

    this.scale.on(Phaser.Scale.Events.ORIENTATION_CHANGE, this.handleOrientationChange, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleOrientationChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ORIENTATION_CHANGE, this.handleOrientationChange, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleOrientationChange, this);
    });

    if (import.meta.env.DEV) {
      this.debugOverlay = new DebugOverlay(this, this.ctx);
    }

    this.handleOrientationChange();
  }

  private handleOrientationChange(): void {
    const isLandscape = this.scale.orientation === Phaser.Scale.Orientation.LANDSCAPE;
    this.orientationHint.setVisible(isLandscape);
  }

  override update(_time: number, delta: number): void {
    // Throttled UI text refresh (§77: bounded work per frame).
    this.acc += delta;
    if (this.acc < UI_REFRESH_MS) return;
    this.acc = 0;

    const snap = this.ctx.metrics.getSnapshot();
    this.fpsText.setText(
      snap.samples > 0
        ? `FPS ${snap.fpsAvg.toFixed(0)}  frame ${snap.frameTimeAvgMs.toFixed(1)}ms`
        : "FPS -",
    );

    this.debugOverlay?.update(delta);
  }
}
