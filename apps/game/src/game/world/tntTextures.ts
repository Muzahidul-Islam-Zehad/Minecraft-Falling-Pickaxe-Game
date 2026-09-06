/**
 * One-time TNT + particle textures (master spec §73, §100: original art only).
 * Generated ONCE at preload — never per frame. Idempotent (§68 re-preload safety).
 */
import Phaser from "phaser";

/** Draw one TNT crate texture: red body, white band, kind-colored stripe. */
function drawTnt(scene: Phaser.Scene, key: string, size: number, stripe: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Crate body.
  g.fillStyle(0xc23b22, 1);
  g.fillRect(1, 1, size - 2, size - 2);
  g.fillStyle(0x8f2417, 1);
  g.fillRect(1, size - 6, size - 2, 5);
  g.fillRect(1, 1, size - 2, 4);
  // White band with the kind stripe across the middle.
  g.fillStyle(0xf2ede4, 1);
  g.fillRect(1, size * 0.4, size - 2, size * 0.22);
  g.fillStyle(stripe, 1);
  g.fillRect(1, size * 0.46, size - 2, size * 0.1);
  // Fuse nub on top.
  g.fillStyle(0x3a2c20, 1);
  g.fillRect(size * 0.42, 0, size * 0.16, 4);
  g.generateTexture(key, size, size);
  g.destroy();
}

/** Small glowing square used by the particle pool (tinted per explosion). */
function drawParticle(scene: Phaser.Scene, key: string, size: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, size, size);
  g.generateTexture(key, size, size);
  g.destroy();
}

/** Entry point called once from PreloadScene. Idempotent: skips keys that exist. */
export function generateTntTextures(scene: Phaser.Scene, size: number): void {
  if (!scene.textures.exists("tnt-classic")) drawTnt(scene, "tnt-classic", size, 0x2b2b2b);
  if (!scene.textures.exists("tnt-mega")) drawTnt(scene, "tnt-mega", size, 0xd4b32a);
  if (!scene.textures.exists("tnt-nuke")) drawTnt(scene, "tnt-nuke", size, 0x35c4a0);
  if (!scene.textures.exists("boom-particle")) drawParticle(scene, "boom-particle", 6);
}
