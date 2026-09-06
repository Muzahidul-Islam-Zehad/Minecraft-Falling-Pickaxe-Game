import Phaser from "phaser";
import { assertValidGameConfig, DEFAULT_GAME_CONFIG } from "@mef/config";
import { GameStateMachine } from "./game/systems/GameStateMachine";
import { MetricsTracker } from "./game/systems/MetricsTracker";
import { BootScene } from "./game/scenes/BootScene";
import { PreloadScene } from "./game/scenes/PreloadScene";
import { GameScene } from "./game/scenes/GameScene";
import { UiScene } from "./game/scenes/UiScene";

/**
 * Game entry (master spec §7): portrait 360×640 logical resolution, FIT + CENTER_BOTH so the
 * real phone resolution is irrelevant to game logic. Config is validated at startup (§82).
 */
const config = assertValidGameConfig(DEFAULT_GAME_CONFIG);
const stateMachine = new GameStateMachine();
const metrics = new MetricsTracker(60);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: config.width,
  height: config.height,
  backgroundColor: "#0d0d12",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
  // Arcade physics (master spec §7, §15): required for static block bodies now and
  // dynamic pickaxe/TNT bodies in Phase 4+. Gravity is the §17 baseline for falling entities.
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, GameScene, UiScene],
});

// §99: don't hide failures. On phones there is no console, so surface fatal errors on-screen
// in dev builds. DOM here is debug/application shell only (§78) — never gameplay UI.
if (import.meta.env.DEV) {
  const showFatal = (message: string): void => {
    let box = document.getElementById("fatal-error");
    if (!box) {
      box = document.createElement("div");
      box.id = "fatal-error";
      box.style.cssText =
        "position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#5b0000e6;color:#ffd7d7;" +
        "font:11px/1.4 monospace;padding:8px;border-radius:4px;white-space:pre-wrap;max-height:40%;overflow:auto";
      document.body.appendChild(box);
    }
    box.textContent += `${message}\n`;
  };
  window.addEventListener("error", (e) => showFatal(`ERROR: ${e.message}\n${e.error?.stack ?? ""}`));
  window.addEventListener("unhandledrejection", (e) => showFatal(`REJECTION: ${String(e.reason)}`));
}

// Shared context consumed by scenes via the registry (§131: separation of concerns).
// nowMs is the shared monotonic game clock for damage/regen timestamps (§14, §120).
game.registry.set("context", {
  config,
  stateMachine,
  metrics,
  nowMs: 0,
} satisfies import("./game/scenes/GameScene").GameContext);

export { game, stateMachine, metrics };
