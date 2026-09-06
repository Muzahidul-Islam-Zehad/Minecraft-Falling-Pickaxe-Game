import Phaser from "phaser";

/**
 * Phaser foundation (master spec §7, Phase 2 scope arrives next).
 * Phase 1 only proves the game app boots, renders portrait, and runs its loop.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  backgroundColor: "#101018",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [],
};

 
console.info("[game] Phaser foundation placeholder — Phase 2 implements scenes");
export const game = new Phaser.Game(config);
