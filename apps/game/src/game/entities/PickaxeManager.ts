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
import {
  clampBodyMotion,
  hasAnyContact,
  reboundSpeed,
  shouldStrikeBounce,
  tumbleFromImpact,
  updateGrindLatch,
  type BodyMotion,
  type ContactFlags,
} from "./pickaxePhysics";
import type { ChunkManager } from "../world/ChunkManager";

export interface Pickaxe {
  sprite: Phaser.Physics.Arcade.Image;
  tier: PickaxeTier;
  damage: number;
  /** Fractional damage accumulators per contacted face+cell (§18): key → 0..<1. */
  mineAccumulators: Map<string, number>;
  /** Strike-rhythm timer for the mining bounce (§17). */
  strikeTimerMs: number;
  /** Contacts the strike rhythm is currently grinding against (any face, §18). */
  miningContacts: ContactFlags;
}

interface PickaxeSprite extends Phaser.Physics.Arcade.Image {
  pickaxeEntity?: Pickaxe;
}

/** Where the base pickaxe starts when a run begins (tier from §16 ladder). */
const BASE_TIER: PickaxeTier = "iron";

export class PickaxeManager {
  private base: PickaxeSprite | null = null;
  private baseCollider: Phaser.Physics.Arcade.Collider | null = null;
  /** Contacts captured by the collide callback this frame (§17/§18), or null. */
  private lastContacts: ContactFlags | null = null;
  /** §18 grinding latch: ms of grinding state remaining after contact stops. */
  private grindLatchMs = 0;
  /** Faces being ground during the latch window (the hop separates them physically). */
  private latchedContacts: ContactFlags | null = null;

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
    // §17: it's a rigid object — no constant spin. It starts with a small random nudge
    // (like being dropped) and tumbles from actual bounces afterwards.
    sprite.setAngularVelocity(Phaser.Math.Between(-120, 120));
    sprite.setVelocity(Phaser.Math.Between(-30, 30), 160);
    (sprite.body as Phaser.Physics.Arcade.Body).setCircle(Math.floor(this.config.blockSizePx * 0.35));

    sprite.pickaxeEntity = {
      sprite,
      tier: def.tier,
      damage: def.damage,
      mineAccumulators: new Map(),
      strikeTimerMs: 0,
      miningContacts: { down: false, up: false, left: false, right: false },
    };
    // Collide with blocks so it LANDS on them and mines through (§17, §18) instead of
    // falling through the world at capped speed. The collide callback reads the impact
    // normal right after separation so each bounce converts into tumble (§17 rigid
    // object behavior: spin comes from impacts, not a constant force).
    this.baseCollider?.destroy();
    this.baseCollider = this.scene.physics.add.collider(
      sprite,
      this.blockBodies,
      // Collide callback (§17, §18): capture contacts BEFORE separation, then
      // (1) Newton's 3rd law — rebound proportional to the incoming impact speed,
      // (2) rigid-object tumble — roll along floors, tumble away from walls.
      // Any pressed face is minable: update() consumes these flags each frame.
      () => {
        const body = sprite.body as Phaser.Physics.Arcade.Body | null;
        if (!body) return;
        const preVx = body.velocity.x;
        const preVy = body.velocity.y;
        const contacts: ContactFlags = {
          down: body.blocked.down,
          up: body.blocked.up,
          left: body.blocked.left,
          right: body.blocked.right,
        };
        // Arcade sometimes reports only `touching` in the collide callback;
        // merge both so a face pressed in EITHER phase counts (§18: never miss a hit).
        const merged: ContactFlags = {
          down: contacts.down || body.touching.down,
          up: contacts.up || body.touching.up,
          left: contacts.left || body.touching.left,
          right: contacts.right || body.touching.right,
        };
        if (hasAnyContact(merged)) {
          this.lastContacts = merged;
          const kick = reboundSpeed(preVx, preVy, merged, this.config);
          if (kick.x !== 0 || kick.y !== 0) {
            body.setVelocity(preVx + kick.x, preVy + kick.y);
          }
        }
        if (merged.down || merged.up) {
          // Floor/ceiling: horizontal speed becomes roll along the surface.
          body.setAngularVelocity(
            tumbleFromImpact(preVx, preVy, 0, merged.down ? 1 : -1, this.config),
          );
        } else if (merged.left || merged.right) {
          // Side impact: vertical speed becomes tumble away from the wall.
          const nx = merged.left ? -1 : 1;
          body.setAngularVelocity(
            tumbleFromImpact(preVx, preVy, nx, 0, this.config),
          );
        }
      },
    );
    this.base = sprite;
    return sprite;
  }

  /**
   * World point for CHUNK STREAMING (§21 "generate ahead"): the pickaxe position plus
   * a lookahead below it, so the window generates slightly ahead of the descent.
   * The CAMERA does not use this — it follows the pure pickaxe position (§22 ratchet,
   * hold-until-middle), keeping the entity at the screen middle as designed.
   */
  getFocusPoint(): { x: number; y: number } {
    const base = this.getBase();
    if (!base) {
      const cam = this.scene.cameras.main;
      return { x: cam.midPoint.x, y: cam.midPoint.y };
    }
    return { x: base.x, y: base.y + this.config.pickaxeCameraLookaheadPx };
  }

  /**
   * Pure pickaxe Y for the camera ratchet (§22): no lookahead — the pickaxe rides the
   * screen middle exactly. While respawning (no base), returns the current view middle
   * so the ratchet simply holds.
   */
  getCameraFocusY(): number {
    const base = this.getBase();
    if (!base) return this.scene.cameras.main.midPoint.y;
    return base.y;
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
    // No spin re-boost here (§17): in air it keeps whatever tumble it has (decaying
    // naturally via angular drag); at rest Arcade friction/zero-tumble lets it settle.

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

    // §18 contacts: instant collision flags this frame PLUS a short grinding latch —
    // the cosmetic strike hop lifts the pickaxe off the block for ~290 ms of every
    // 240 ms cycle, which used to gate mining to ~25% duty cycle (blocks took ~4×
    // longer to break than the old down-only probe). With the latch, damage flows at
    // full rate through the hop: mining duty cycle is ~100% again.
    const instant: ContactFlags = this.lastContacts ?? {
      down: body.blocked.down,
      up: body.blocked.up,
      left: body.blocked.left,
      right: body.blocked.right,
    };
    this.lastContacts = null;
    const touchingNow = hasAnyContact(instant);
    if (touchingNow) this.latchedContacts = instant;
    this.grindLatchMs = updateGrindLatch(touchingNow, this.grindLatchMs, deltaMs, this.config);
    const grinding = this.grindLatchMs > 0;
    if (!grinding) this.latchedContacts = null;
    // Mine the faces we're touching; mid-hop, keep mining the latched faces.
    const contacts: ContactFlags = touchingNow ? instant : this.latchedContacts ?? instant;

    const pickaxe = base.pickaxeEntity!;
    pickaxe.miningContacts = grinding
      ? contacts
      : { down: false, up: false, left: false, right: false };
    pickaxe.strikeTimerMs += deltaMs;
    // §17 strike rhythm pulses only on REAL contact (hammering feel) — never mid-air.
    if (shouldStrikeBounce(touchingNow, pickaxe.strikeTimerMs, this.config)) {
      pickaxe.strikeTimerMs = 0;
      const strikeV = this.config.pickaxeMiningBounceVelocityPxPerSec;
      let vx = 0;
      let vy = 0;
      if (contacts.down) vy -= strikeV;
      if (contacts.up) vy += strikeV;
      if (contacts.left) vx += strikeV;
      if (contacts.right) vx -= strikeV;
      if (vx !== 0 || vy !== 0) body.setVelocity(vx, vy);
      // Each strike reverses the small spin → the rocking motion of chopping.
      const currentSpin = body.angularVelocity;
      const strikeSpin =
        Math.abs(currentSpin) > 30 ? -Math.sign(currentSpin) * this.config.pickaxeMiningStrikeSpinDegPerSec : this.config.pickaxeMiningStrikeSpinDegPerSec;
      body.setAngularVelocity(strikeSpin);
    }

    this.mineContacts(base, deltaMs, contacts);

    // Respawn guard: if it somehow escapes far below the view, recreate above the view.
    const camBottom = this.scene.cameras.main.scrollY + this.config.height;
    if (base.y > camBottom + this.config.height) {
      this.removeBase();
    }
  }

  /** Despawn the base pickaxe and its collider (§70/§128 hygiene). */
  private removeBase(): void {
    this.lastContacts = null;
    this.grindLatchMs = 0;
    this.latchedContacts = null;
    this.baseCollider?.destroy();
    this.baseCollider = null;
    this.base?.destroy();
    this.base = null;
  }

  /**
   * Omnidirectional continuous mining (§18 flow): every face the pickaxe is pressing
   * against mines the block BEHIND that face — below, left, right, and above alike.
   * Each face has its own fractional accumulator; damage flows through the same
   * ChunkManager.damageCell path as every other event. The accumulator lives on the
   * contacted face's cell, so switching to a fresh block restarts it at zero.
   */
  private mineContacts(base: PickaxeSprite, deltaMs: number, contacts: ContactFlags): void {
    if (!hasAnyContact(contacts)) return;
    const pickaxe = base.pickaxeEntity!;
    const body = base.body as Phaser.Physics.Arcade.Body;
    const offsetX = this.worldOffsetX();
    const deltaDamage = (deltaMs / 1000) * pickaxe.damage * this.config.pickaxeMiningHitsPerSecond;
    const radius = body.radius;
    const reach = Math.max(radius, this.config.blockSizePx * 0.3) + 2;

    // Face → contact axis (+ direction). The probe reaches 2px past the circle edge so
    // it always lands INSIDE the contacted block.
    const faces: Array<{ key: keyof ContactFlags; axis: "x" | "y"; sign: 1 | -1 }> = [
      { key: "down", axis: "y", sign: 1 },
      { key: "up", axis: "y", sign: -1 },
      { key: "left", axis: "x", sign: -1 },
      { key: "right", axis: "x", sign: 1 },
    ];

    for (const face of faces) {
      if (!contacts[face.key]) continue;
      // Contact-PATCH sampling: the pickaxe is a circle of `radius`, so a pressed face
      // can physically touch up to 3 cells (resting across a column seam → both floor
      // blocks; leaning on a wall → both rows it spans). Probe the center PLUS both
      // edges (±radius) along the perpendicular axis — every solid block in the
      // contact patch takes damage, not just the one under the center point.
      for (const off of [-radius, 0, radius]) {
        const probeX = face.axis === "y" ? base.x + off : base.x + face.sign * reach;
        const probeY = face.axis === "y" ? base.y + face.sign * reach : base.y + off;
        const col = Math.floor((probeX - offsetX) / this.config.blockSizePx);
        if (col < 0 || col >= this.config.chunkWidth) continue; // beside the world
        const worldRow = Math.floor(probeY / this.config.blockSizePx);
        const chunkId = Math.floor(worldRow / this.config.chunkHeight);
        const row = ((worldRow % this.config.chunkHeight) + this.config.chunkHeight) % this.config.chunkHeight;
        const chunk = this.chunkManager.getChunk(chunkId);
        if (!chunk) continue;
        const cell = chunk.cells[row * chunk.width + col];
        if (!cell || cell.type === null) continue; // open space behind the face

        // Key is per-cell, so duplicate probes across faces merge cleanly and each
        // contacted block accumulates its own full-rate damage.
        const key = `${chunkId}:${col}:${row}`;
        const accumulated = (pickaxe.mineAccumulators.get(key) ?? 0) + deltaDamage;
        if (accumulated >= 1) {
          this.chunkManager.damageCell(chunkId, col, row, Math.floor(accumulated), this.getNowMs());
          pickaxe.mineAccumulators.set(key, accumulated - Math.floor(accumulated));
        } else {
          pickaxe.mineAccumulators.set(key, accumulated);
        }
      }
    }

    // Bounded stale entries (§70-style hygiene): clear when the map grows past a cap.
    if (pickaxe.mineAccumulators.size > 16) pickaxe.mineAccumulators.clear();
  }

  /** Shared horizontal world offset (registry-set by GameScene). */
  private worldOffsetX(): number {
    return (this.scene.registry.get("world.offsetX") as number | undefined) ?? 0;
  }

  destroy(): void {
    this.removeBase();
  }
}
