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
  scene: [BootScene, PreloadScene, GameScene, UiScene],
});

// Shared context consumed by scenes via the registry (§131: separation of concerns).
// nowMs is the shared monotonic game clock for damage/regen timestamps (§14, §120).
game.registry.set("context", {
  config,
  stateMachine,
  metrics,
  nowMs: 0,
} satisfies import("./game/scenes/GameScene").GameContext);

export { game, stateMachine, metrics };
