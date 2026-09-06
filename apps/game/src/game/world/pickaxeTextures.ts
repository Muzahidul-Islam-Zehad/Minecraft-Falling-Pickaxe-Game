/**
 * One-time pickaxe tier textures (master spec §16, §73).
 * Generated ONCE at preload — never per frame. Original art (§100).
 */
import Phaser from "phaser";
import { PICKAXE_DEFINITIONS } from "@mef/config";

/** Handle colors per tier (progression should be readable on screen, §90). */
const TIER_COLORS: Record<string, { handle: number; head: number; edge: number }> = {
  wood: { handle: 0x8b5a2b, head: 0xa0703a, edge: 0xc49050 },
  stone: { handle: 0x8b5a2b, head: 0x7d7d7d, edge: 0x9a9a9a },
  iron: { handle: 0x8b5a2b, head: 0xd8d8e0, edge: 0xf4f4f8 },
  gold: { handle: 0x8b5a2b, head: 0xf5d442, edge: 0xffe97a },
  diamond: { handle: 0x8b5a2b, head: 0x4aedd9, edge: 0x9df8ec },
  netherite: { handle: 0x5a4a3f, head: 0x4a3f45, edge: 0x8a7a80 },
};

export function generatePickaxeTextures(scene: Phaser.Scene, size = 28): void {
  for (const def of PICKAXE_DEFINITIONS) {
    if (scene.textures.exists(def.textureKey)) continue; // §68: re-preload safety
    const colors = TIER_COLORS[def.tier] ?? TIER_COLORS.wood!;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    // Diagonal handle (bottom-left → top-right).
    g.fillStyle(colors.handle, 1);
    g.fillRect(11, 8, 5, 18);
    // Pickaxe head: two prongs across the top.
    g.fillStyle(colors.head, 1);
    g.fillRect(4, 6, 20, 6);
    g.fillStyle(colors.edge, 1);
    g.fillRect(4, 6, 20, 2);

    g.generateTexture(def.textureKey, size, size);
    g.destroy();
  }
}
