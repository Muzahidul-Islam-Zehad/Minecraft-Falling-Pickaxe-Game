/**
 * ONE base pickaxe (core design, §16–§18 + §22): it falls forever, the camera follows it,
 * and it continuously mines the block(s) it presses against. Viewer-spawned extra pickaxes
 * arrive in later phases as pooled additions around this base entity (§19).
 *
 * §23: the base pickaxe spawns above the camera view in open air — never inside geometry.
 * §70: velocity/angular caps + NaN kill switch every tick.
 */
import Phaser from "phaser";
import { PICKAXE_BY_TIER, type GameConfig, type PickaxeTier } from "@mef/config";
import { clampBodyMotion, type BodyMotion } from "./pickaxePhysics";
import type { ChunkManager } from "../world/ChunkManager";

export interface Pickaxe {
  sprite: Phaser.Physics.Arcade.Image;
  tier: PickaxeTier;
  damage: number;
  /** Fractional damage accumulator for continuous mining (§18). */
  mineAccumulator: number;
}

interface PickaxeSprite extends Phaser.Physics.Arcade.Image {
  pickaxeEntity?: Pickaxe;
}

/** Where the base pickaxe starts when a run begins (tier from §16 ladder). */
const BASE_TIER: PickaxeTier = "iron";

export class PickaxeManager {
  private base: PickaxeSprite | null = null;
  private baseCollider: Phaser.Physics.Arcade.Collider | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GameConfig,
    private readonly chunkManager: ChunkManager,
    /** Static group of block bodies: the base pickaxe lands ON blocks and mines (§18). */
    private readonly blockBodies: Phaser.Physics.Arcade.StaticGroup,
    private readonly getNowMs: () => number,
  ) {}

  /** The base pickaxe, or null while a respawn is pending. */
  getBase(): PickaxeSprite | null {
    return this.base && this.base.active ? this.base : null;
  }

  /** Active entity count for the debug overlay (§96): 1 base + 0 extras in Phase 4. */
  get activeCount(): number {
    return this.getBase() ? 1 : 0;
  }

  /**
   * Ensure the base pickaxe exists (§16): (re)create above the camera view when missing —
   * e.g. first spawn, or after the §70 NaN kill switch removed a corrupt entity.
   */
  ensureBase(): PickaxeSprite {
    if (this.base && this.base.active) return this.base;

    const def = PICKAXE_BY_TIER.get(BASE_TIER) ?? PICKAXE_BY_TIER.get("iron")!;
    const offsetX = this.worldOffsetX();
    // §23: open air above the camera — never inside a block. Spawn at a COLUMN CENTER,
    // never on the seam between two blocks (a circle resting on a seam wedges and spins).
    const spawnCol = Math.floor(this.config.chunkWidth / 2);
    const x = offsetX + spawnCol * this.config.blockSizePx + this.config.blockSizePx / 2;
    const y = this.scene.cameras.main.scrollY - this.config.pickaxeSpawnMarginPx;

    const sprite = this.scene.physics.add.image(x, y, def.textureKey) as PickaxeSprite;
    sprite.setDepth(8);
    sprite.setBounce(0.2, 0.2);
    sprite.setAngularVelocity(220);
    sprite.setVelocity(0, 160);
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(Math.floor(this.config.blockSizePx * 0.35));

    sprite.pickaxeEntity = {
      sprite,
      tier: def.tier,
      damage: def.damage,
      mineAccumulator: 0,
    };
    // Collide with blocks so it LANDS on them and mines through (§17, §18) instead of
    // falling through the world at capped speed.
    this.baseCollider?.destroy();
    this.baseCollider = this.scene.physics.add.collider(sprite, this.blockBodies);
    this.base = sprite;
    return sprite;
  }

  /** World point the camera should follow (§22): the pickaxe plus lookahead below it. */
  getFocusPoint(): { x: number; y: number } {
    const base = this.getBase();
    if (!base) {
      const cam = this.scene.cameras.main;
      return { x: cam.midPoint.x, y: cam.midPoint.y };
    }
    return { x: base.x, y: base.y + this.config.pickaxeCameraLookaheadPx };
  }

  /** Per-frame tick (§70 caps, continuous mining §18, respawn guard). */
  update(deltaMs: number): void {
    const base = this.getBase();
    if (!base) {
      this.ensureBase();
      return;
    }
    const body = base.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;

    const motion: BodyMotion = {
      x: base.x,
      y: base.y,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      angularVelocity: body.angularVelocity,
    };
    const clamped = clampBodyMotion(motion, this.config);
    if (!clamped.valid) {
      // §70: despawn corrupt entity; ensureBase() respawns next tick.
      this.removeBase();
      return;
    }
    body.velocity.x = clamped.velocityX;
    body.velocity.y = clamped.velocityY;
    body.angularVelocity = clamped.angularVelocity;

    // Keep it spinning while falling (§17 visual).
    if (Math.abs(body.angularVelocity) < 60) body.angularVelocity = 220;

    // §70 safety: never let a bounce carry the pickaxe outside the world column — it would
    // fall forever beside the world (camera X is fixed). Clamp to the inner bounds.
    const wox = this.worldOffsetX();
    const worldLeft = wox + body.radius + 2;
    const worldRight = wox + this.config.chunkWidth * this.config.blockSizePx - body.radius - 2;
    if (base.x < worldLeft) {
      base.x = worldLeft;
      if (body.velocity.x < 0) body.velocity.x = 0;
    } else if (base.x > worldRight) {
      base.x = worldRight;
      if (body.velocity.x > 0) body.velocity.x = 0;
    }

    this.mineBelow(base, body, deltaMs);

    // Respawn guard: if it somehow escapes far below the view, recreate above the view.
    const camBottom = this.scene.cameras.main.scrollY + this.config.height;
    if (base.y > camBottom + this.config.height) {
      this.removeBase();
    }
  }

  /** Despawn the base pickaxe and its collider (§70/§128 hygiene). */
  private removeBase(): void {
    this.baseCollider?.destroy();
    this.baseCollider = null;
    this.base?.destroy();
    this.base = null;
  }

  /**
   * Continuous mining (§18 flow): while the pickaxe presses on a solid block below,
   * deal damage × miningHitsPerSecond per second via an accumulator. Cracks/destroy/
   * rewards flow through the same ChunkManager.damageCell path as every other event.
   */
  private mineBelow(base: PickaxeSprite, body: Phaser.Physics.Arcade.Body, deltaMs: number): void {
    const pickaxe = base.pickaxeEntity!;
    const probeY = base.y + Math.max(body.radius, this.config.blockSizePx * 0.3) + 2;
    const offsetX = this.worldOffsetX();

    const col = Math.floor((base.x - offsetX) / this.config.blockSizePx);
    const worldRow = Math.floor(probeY / this.config.blockSizePx);
    const chunkId = Math.floor(worldRow / this.config.chunkHeight);
    const row = ((worldRow % this.config.chunkHeight) + this.config.chunkHeight) % this.config.chunkHeight;

    const chunk = this.chunkManager.getChunk(chunkId);
    if (!chunk) return;
    const cell = chunk.cells[row * chunk.width + col];
    if (!cell || cell.type === null) return; // falling through open space

    pickaxe.mineAccumulator += (deltaMs / 1000) * pickaxe.damage * this.config.pickaxeMiningHitsPerSecond;
    if (pickaxe.mineAccumulator >= 1) {
      const amount = Math.floor(pickaxe.mineAccumulator);
      pickaxe.mineAccumulator -= amount;
      this.chunkManager.damageCell(chunkId, col, row, amount, this.getNowMs());
    }
  }

  /** Shared horizontal world offset (registry-set by GameScene). */
  private worldOffsetX(): number {
    return (this.scene.registry.get("world.offsetX") as number | undefined) ?? 0;
  }

  destroy(): void {
    this.removeBase();
  }
}
