/**
 * Viewer attribution labels (master spec §26): "💣 TNT / Zehad123" above each
 * viewer-created TNT. Phaser text ONLY — never DOM, never raw HTML (§78). Names are
 * sanitized by tntLogic.sanitizeOwnerName before they reach this layer.
 *
 * Pooled + budget-capped (§20): at most maxAttributionLabels exist; the oldest label
 * is recycled when the budget is hit. Lifecycle: show → hold ~3 s → fade ~0.5 s →
 * release to pool (§26 timings from config).
 */
import Phaser from "phaser";
import type { GameConfig } from "@mef/config";

interface LabelSprite extends Phaser.GameObjects.Text {
  holdUntil?: number;
  fadeStartAt?: number;
}

export class AttributionLabels {
  private readonly pool: LabelSprite[] = [];
  private readonly live: LabelSprite[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GameConfig,
  ) {}

  get activeCount(): number {
    return this.live.length;
  }

  /** Show a label at a world position; recycles the oldest when at budget (§26). */
  show(x: number, y: number, ownerName: string, nowMs: number): void {
    let label = this.pool.pop();
    if (!label) {
      if (this.live.length >= this.config.maxAttributionLabels) {
        // Budget: recycle the OLDEST (shift), never grow unbounded.
        label = this.live.shift()!;
      } else {
        label = this.scene.add
          .text(0, 0, "", {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#ffe9a8",
            backgroundColor: "#000000aa",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(12);
      }
    }
    label.setText(ownerName);
    label.setPosition(x, y);
    label.setAlpha(1).setVisible(true);
    label.holdUntil = nowMs + this.config.attributionLabelHoldMs;
    label.fadeStartAt = nowMs + this.config.attributionLabelHoldMs;
    label.setData("fadeMs", this.config.attributionLabelFadeMs);
    this.live.push(label);
  }

  /** Per-frame tick: hold → fade → release (§26 lifecycle, zero timers). */
  update(nowMs: number, cameraScrollY: number, viewportHeight: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const label = this.live[i]!;
      const fadeMs = (label.getData("fadeMs") as number) ?? this.config.attributionLabelFadeMs;
      if (nowMs >= label.fadeStartAt!) {
        const t = (nowMs - label.fadeStartAt!) / fadeMs;
        if (t >= 1) {
          label.setVisible(false);
          this.live.splice(i, 1);
          this.pool.push(label);
          continue;
        }
        label.setAlpha(1 - t);
      }
      // Cull labels scrolled far off-screen (§75-style hygiene: don't render what the
      // camera can't see). They still expire on schedule.
      const dy = label.y - (cameraScrollY + viewportHeight);
      label.setVisible(dy < viewportHeight);
      void cameraScrollY;
    }
  }

  destroy(): void {
    for (const l of this.live) l.destroy();
    this.live.length = 0;
    for (const l of this.pool) l.destroy();
    this.pool.length = 0;
  }
}
