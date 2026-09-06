/**
 * One-time texture generation for the block world (master spec §12, §13, §73).
 * All textures are created ONCE at preload — never per frame. Patterns are fixed
 * (deterministic), no Math.random, so visuals are stable across runs.
 */
import Phaser from "phaser";
import { BLOCK_DEFINITIONS } from "@mef/config";

/** Base palette per block id (original placeholder art, §100: no copyrighted assets). */
const COLORS: Record<string, { base: number; dark: number; speck: number }> = {
  bedrock: { base: 0x1c1c22, dark: 0x0c0c10, speck: 0x33333d },
  stone: { base: 0x7d7d7d, dark: 0x5f5f5f, speck: 0x8f8f8f },
  andesite: { base: 0x888a86, dark: 0x6b6d69, speck: 0x9a9c98 },
  diorite: { base: 0xc9c9c4, dark: 0xa8a8a2, speck: 0xdededa },
  granite: { base: 0x9a6b5a, dark: 0x7a5244, speck: 0xb08272 },
  coal: { base: 0x4a4a4a, dark: 0x2e2e2e, speck: 0x1f1f1f },
  iron: { base: 0xd8af93, dark: 0xb98f74, speck: 0xe8c7ad },
  copper: { base: 0xc76f3b, dark: 0xa5562c, speck: 0xdd8b55 },
  redstone: { base: 0x8a1f1f, dark: 0x6b1414, speck: 0xff3b3b },
  lapis: { base: 0x2f5fd0, dark: 0x1f429c, speck: 0x5b86e8 },
  gold: { base: 0xf5d442, dark: 0xd4b32a, speck: 0xffe97a },
  diamond: { base: 0x4aedd9, dark: 0x2fc9b6, speck: 0x9df8ec },
  emerald: { base: 0x17dd62, dark: 0x10b04b, speck: 0x6cf0a0 },
  obsidian: { base: 0x14101f, dark: 0x0a0812, speck: 0x2c2440 },
  mossy_cobblestone: { base: 0x6a7d4f, dark: 0x52623b, speck: 0x82976a },
  cobblestone: { base: 0x8a8a8a, dark: 0x6f6f6f, speck: 0xa0a0a0 },
  dirt: { base: 0x8b5a2b, dark: 0x6f451f, speck: 0xa06f3d },
  grass: { base: 0x8b5a2b, dark: 0x6f451f, speck: 0xa06f3d },
};

/** Draw one block texture: base fill, darker bottom/right edge, fixed speckles. */
function drawBlockTexture(scene: Phaser.Scene, key: string, id: string, size: number): void {
  const palette = COLORS[id] ?? COLORS.stone!;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(palette.base, 1);
  g.fillRect(0, 0, size, size);
  g.fillStyle(palette.dark, 1);
  g.fillRect(0, size - 4, size, 4);
  g.fillRect(size - 4, 0, 4, size);
  g.fillStyle(palette.speck, 1);
  // Fixed speckle pattern (deterministic, §10 spirit).
  g.fillRect(5, 6, 3, 3);
  g.fillRect(19, 12, 3, 3);
  g.fillRect(10, 22, 3, 3);
  g.fillRect(24, 24, 2, 2);

  if (id === "grass") {
    g.fillStyle(0x5fae3f, 1);
    g.fillRect(0, 0, size, 7);
    g.fillStyle(0x4c9132, 1);
    g.fillRect(0, 5, size, 2);
  }

  g.generateTexture(key, size, size);
  g.destroy();
}

/** Fixed crack line segments per stage; stage N draws segments 1..N (§13: 0→9). */
const CRACK_SEGMENTS: Array<Array<[number, number, number, number]>> = [
  [[16, 16, 10, 8]],
  [[16, 16, 10, 8], [10, 8, 4, 10]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10], [22, 10, 28, 14]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10], [22, 10, 28, 14], [16, 16, 20, 24]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10], [22, 10, 28, 14], [16, 16, 20, 24], [20, 24, 24, 30]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10], [22, 10, 28, 14], [16, 16, 20, 24], [20, 24, 24, 30], [16, 16, 8, 22]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10], [22, 10, 28, 14], [16, 16, 20, 24], [20, 24, 24, 30], [16, 16, 8, 22], [8, 22, 3, 27]],
  [[16, 16, 10, 8], [10, 8, 4, 10], [16, 16, 22, 10], [22, 10, 28, 14], [16, 16, 20, 24], [20, 24, 24, 30], [16, 16, 8, 22], [8, 22, 3, 27], [16, 16, 28, 26]],
];

/** Generate the 9 crack overlay textures (transparent background, §13). */
function drawCrackTextures(scene: Phaser.Scene, size: number): void {
  for (let stage = 1; stage <= 9; stage++) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.lineStyle(2, 0x000000, 0.85);
    for (const [x1, y1, x2, y2] of CRACK_SEGMENTS[stage - 1]!) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    }
    g.generateTexture(`crack-${stage}`, size, size);
    g.destroy();
  }
}

/** Entry point called once from PreloadScene. */
export function generateWorldTextures(scene: Phaser.Scene, blockSizePx: number): void {
  for (const def of BLOCK_DEFINITIONS) {
    drawBlockTexture(scene, def.textureKey, def.id, blockSizePx);
  }
  drawCrackTextures(scene, blockSizePx);
}
