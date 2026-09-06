import Phaser from "phaser";
import type { GameContext } from "../game/scenes/GameScene";

/**
 * Debug overlay (master spec §96): FPS/frame time, game state, renderer, memory hints.
 * Created ONLY in dev builds (import.meta.env.DEV), toggled with the D key, and refreshes
 * on a throttled interval — never every frame (§77).
 */
export class DebugOverlay {
  private static readonly REFRESH_INTERVAL_MS = 250;

  private readonly text: Phaser.GameObjects.Text;
  private readonly registry: Phaser.Data.DataManager;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private visible = true;
  private acc = 0;

  constructor(scene: Phaser.Scene, private readonly ctx: GameContext) {
    this.registry = scene.registry;
    this.text = scene.add
      .text(12, 64, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#7fff9f",
        backgroundColor: "#000000aa",
        padding: { x: 4, y: 3 },
      })
      .setDepth(30);

    this.onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "d" || event.key === "D") this.toggle();
    };
    window.addEventListener("keydown", this.onKeyDown);

    // §128: remove global listener when the scene dies.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy(scene));
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
  }

  private destroy(scene: Phaser.Scene): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.text.destroy();
    void scene;
  }

  update(deltaMs: number): void {
    if (!this.visible) return;
    this.acc += deltaMs;
    if (this.acc < DebugOverlay.REFRESH_INTERVAL_MS) return;
    this.acc = 0;

    const snap = this.ctx.metrics.getSnapshot();
    const fpsMin = snap.samples > 0 ? snap.fpsMin.toFixed(0) : "-";
    const fpsMax = snap.samples > 0 ? snap.fpsMax.toFixed(0) : "-";
    const memory = (
      performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
    ).memory;

    const chunks = this.registry.get("world.chunkCount") as number | undefined;
    const distance = this.registry.get("world.distance") as number | undefined;
    const runSeed = this.registry.get("world.runSeed") as number | undefined;
    const pickaxes = this.registry.get("world.pickaxes") as number | undefined;
    const textures = this.registry.get("world.textures") as number | undefined;
    const tnt = this.registry.get("world.tnt") as number | undefined;
    const particles = this.registry.get("world.particles") as number | undefined;

    const lines = [
      `FPS    ${snap.fpsAvg.toFixed(1)}  (min ${fpsMin} / max ${fpsMax})`,
      `frame  ${snap.frameTimeAvgMs.toFixed(2)} ms  (max ${snap.frameTimeMaxMs.toFixed(1)})`,
      `state  ${this.ctx.stateMachine.current}`,
      `depth  ${distance ?? 0}px  chunks ${chunks ?? 0}  rt ${textures ?? "-"}  seed ${runSeed ?? "-"}`,
      `ent    pickaxes ${pickaxes ?? 0}/${this.ctx.config.maxActivePickaxes}  tnt ${tnt ?? 0}/${this.ctx.config.maxActiveTnt}  fx ${particles ?? 0}/${this.ctx.config.maxParticles}`,
      `orient ${window.innerWidth > window.innerHeight ? "LANDSCAPE" : "portrait"}`,
      `dpr    ${window.devicePixelRatio.toFixed(2)}`,
      memory
        ? `heap   ${(memory.usedJSHeapSize / 1048576).toFixed(1)} / ${(memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB`
        : "heap   n/a",
    ];
    this.text.setText(lines.join("\n"));
  }
}
