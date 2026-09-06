import Phaser from "phaser";
import { BLOCK_DEFINITIONS } from "@mef/config";
import type { GameContext } from "./GameScene";
import { WORLD_INFO_KEYS } from "./GameScene";
import { DebugOverlay } from "../../ui/DebugOverlay";
import type { StatsSnapshot } from "../systems/StatsTracker";

const UI_REFRESH_MS = 250;

/** One HUD stat row: label + count. Text objects are created ONCE (§24, §73). */
interface HudRow {
  readonly label: Phaser.GameObjects.Text;
  readonly value: Phaser.GameObjects.Text;
  lastValue: string;
}

/**
 * UiScene (master spec §24, §130): fixed UI layer, lightweight Phaser text only —
 * never DOM (§78). The Phase 6 rewards HUD shows depth, blocks destroyed, and one row
 * per REWARD-BEARING block type, derived from BLOCK_DEFINITIONS (data-driven, §104 —
 * adding an ore in config automatically adds a HUD row; zero code changes).
 *
 * Loophole guards:
 * - setText fires ONLY when the value string changed — Phaser rebuilds the text texture
   even for identical strings, which would churn the GPU every 250 ms.
 * - Null-guards the stats registry entry: UiScene launches in PARALLEL with GameScene,
 *   so the first frames can legally arrive before any snapshot exists.
 */
export class UiScene extends Phaser.Scene {
  private ctx!: GameContext;
  private fpsText!: Phaser.GameObjects.Text;
  private depthRow!: HudRow;
  private blocksRow!: HudRow;
  /** One row per reward-bearing block type, in catalog order (§24: diamond, emerald…). */
  private rewardRows: Array<{ item: string; row: HudRow }> = [];
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

    this.fpsText = this.add.text(12, 32, "FPS -", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#9fb4c7",
    }).setDepth(10);

    // §24 HUD panel — rows created once, updated in place on the shared throttle.
    const rowStyle = (bold: boolean): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: "monospace",
      fontSize: bold ? "13px" : "12px",
      color: bold ? "#ffffff" : "#d7c9a8",
      backgroundColor: "#00000066",
      padding: { x: 4, y: 1 },
    });
    let y = 54;
    const makeRow = (label: string, bold: boolean): HudRow => {
      const labelText = this.add.text(12, y, label, rowStyle(bold)).setDepth(10);
      const valueText = this.add.text(this.ctx.config.width - 12, y, "0", {
        ...rowStyle(bold),
      }).setOrigin(1, 0).setDepth(10);
      y += bold ? 20 : 17;
      return { label: labelText, value: valueText, lastValue: "" };
    };

    this.depthRow = makeRow("DEPTH", true);
    this.blocksRow = makeRow("BLOCKS", true);
    // Data-driven rows (§104): every block with a reward definition gets a row.
    for (const def of BLOCK_DEFINITIONS) {
      if (!def.reward) continue;
      this.rewardRows.push({ item: def.reward.item, row: makeRow(def.reward.item.toUpperCase(), false) });
    }

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

  /** Update one row's value only if the string changed (no GPU churn, §77). */
  private setRow(row: HudRow, value: string): void {
    if (row.lastValue === value) return;
    row.lastValue = value;
    row.value.setText(value);
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

    // §24 rewards: registry snapshot may not exist yet (parallel scene launch).
    const stats = this.registry.get(WORLD_INFO_KEYS.hudStats) as StatsSnapshot | undefined;
    const distance = this.registry.get(WORLD_INFO_KEYS.distance) as number | undefined;
    this.setRow(this.depthRow, `${distance ?? 0}px`);
    if (stats) {
      this.setRow(this.blocksRow, String(stats.blocksDestroyed));
      for (const { item, row } of this.rewardRows) {
        this.setRow(row, String(stats.byType[item] ?? 0));
      }
    }

    this.debugOverlay?.update(delta);
  }
}
