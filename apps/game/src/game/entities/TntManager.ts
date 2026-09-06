/**
 * TNT manager (master spec §25–§30) — Minecraft-style placement semantics (user spec):
 * TNT does NOT fall. It is created AT the base pickaxe's position, blinks during the
 * fuse (like Minecraft), then explodes right there. No physics body, no collision.
 *
 * Loophole guards baked in:
 * - §25 lifecycle is a strict state machine; every entity explodes EXACTLY ONCE because
 *   only TRIGGERED→EXPLODING may apply damage and EXPLODING→DONE is immediate.
 * - §23 spawn safety: the pickaxe position is open air BY CONSTRUCTION (it falls through
 *   it), so placement there can never embed TNT in geometry. While no base exists
 *   (respawn frame), spawns are deferred — and dropped after a bounded delay.
 * - §27 explosions apply cells from the PURE selector (spatial filter — the world is
 *   never scanned) through the single ChunkManager.damageCell path.
 * - §28 NO chain reactions: explosions damage blocks only; the manager never iterates
 *   other TNT entities — guaranteed structurally, not by a flag.
 * - §30 NUKE is a staggered BURST: ≤ maxNukeTnt entities (last = the nuke itself),
 *   particle total ≤ maxNukeParticles, paced from the update loop (zero setTimeouts).
 * - No timers anywhere: fuses and blink phases are evaluated from the game clock.
 */
import Phaser from "phaser";
import { TNT_BY_KIND, type GameConfig, type TntKind } from "@mef/config";
import {
  explosionCells,
  nukeBurstKind,
  sanitizeOwnerName,
  transitionTnt,
  type TntLifecycle,
} from "./tntLogic";
import type { ChunkManager } from "../world/ChunkManager";
import type { ParticlePool } from "../effects/ParticlePool";
import type { AttributionLabels } from "../effects/AttributionLabels";
import type { CameraController } from "../CameraController";

interface TntEntity {
  sprite: Phaser.GameObjects.Image;
  kind: TntKind;
  lifecycle: TntLifecycle;
  fuseAt: number;
  fuseTotalMs: number;
  spawnedAt: number;
  ownerId: string;
  /** §30: spawned as part of a NUKE burst — particle share comes from the nuke budget. */
  isNukeBurst: boolean;
}

interface PendingSpawn {
  kind: TntKind;
  queuedAt: number;
  fireAt: number;
  ownerId: string;
  isNukeBurst: boolean;
}

/** Particle tint per kind (cosmetic only). */
const TINTS: Record<TntKind, number> = { tnt: 0xff8c42, mega: 0xffd54a, nuke: 0x7dffb8 };

export class TntManager {
  private readonly entities: TntEntity[] = [];
  private readonly spritePool: Phaser.GameObjects.Image[] = [];
  private pending: PendingSpawn[] = [];
  private nukeQueued = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GameConfig,
    private readonly chunkManager: ChunkManager,
    private readonly particles: ParticlePool,
    private readonly labels: AttributionLabels,
    private readonly camera: CameraController,
    private readonly getNowMs: () => number,
    private readonly getBasePickaxe: () => { x: number; y: number } | null,
  ) {}

  get activeCount(): number {
    return this.entities.length;
  }

  /** Spawn requests waiting for a base pickaxe / their stagger time (§30 NUKE pacing). */
  get pendingCount(): number {
    return this.pending.length;
  }

  /**
   * Queue one TNT. Placement happens in update() at the pickaxe's position (user spec:
   * TNT is created where the pickaxe is — it never falls). Viewer names are sanitized
   * HERE — nothing unsanitized is ever stored (§26).
   */
  queue(kind: TntKind, ownerId?: string): void {
    const safeName = ownerId ? sanitizeOwnerName(ownerId, this.config.ownerNameMaxChars) : "";
    this.pending.push({ kind, queuedAt: this.getNowMs(), fireAt: this.getNowMs(), ownerId: safeName, isNukeBurst: false });
  }

  /**
   * NUKE (§30): a staggered burst — (maxNukeTnt − 1) tnt/mega alternating plus the
   * central nuke entity last. One NUKE burst at a time (re-entry ignored while bursting).
   */
  queueNuke(ownerId?: string): void {
    if (this.nukeQueued > 0) return; // burst already in progress
    const safeName = ownerId ? sanitizeOwnerName(ownerId, this.config.ownerNameMaxChars) : "";
    const now = this.getNowMs();
    const stagger = this.config.nukeTntStaggerMs;
    for (let i = 0; i < this.config.maxNukeTnt - 1; i++) {
      this.pending.push({
        kind: nukeBurstKind(i),
        queuedAt: now,
        fireAt: now + i * stagger,
        ownerId: safeName,
        isNukeBurst: true,
      });
    }
    // The nuke itself lands center-stage at the end of the burst.
    this.pending.push({
      kind: "nuke",
      queuedAt: now,
      fireAt: now + this.config.maxNukeTnt * stagger,
      ownerId: safeName,
      isNukeBurst: true,
    });
    this.nukeQueued = 1; // burst in progress: further NUKEs wait until it fully lands
  }

  update(_deltaMs: number): void {
    const now = this.getNowMs();

    // 0. Drop stale pending requests (bounded queue, §19): if no base pickaxe existed
    // for tntSpawnMaxDelayMs, the request is dropped — never accumulates forever.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (now - p.queuedAt > this.config.tntSpawnMaxDelayMs) {
        this.pending.splice(i, 1);
        if (p.kind === "nuke") this.nukeQueued = 0;
      }
    }

    // 1. Fire due pending placements at the pickaxe's position (§23: open by construction).
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (now < p.fireAt) continue;
      const base = this.getBasePickaxe();
      if (!base) continue; // respawn frame: defer (bounded by the drop rule above)
      this.spawnAt(base.x, base.y, p);
      this.pending.splice(i, 1);
      if (p.kind === "nuke") this.nukeQueued = 0; // burst fully placed
    }

    // 2. Per-entity: blink phase (Minecraft-style), fuse expiry, lifetime safety net.
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i]!;
      const remaining = entity.fuseAt - now;

      // Minecraft-style blink: white flashes accelerate as the fuse burns down.
      const interval = Math.max(60, remaining / 6);
      const blinkOn = Math.floor(now / interval) % 2 === 0;
      if (blinkOn) entity.sprite.setTintFill(0xffffff);
      else entity.sprite.clearTint();

      if (remaining <= 0) {
        this.explode(entity);
        continue;
      }
      // §20 lifetime safety net: no entity can outlive the budget, whatever future
      // edits introduce — force-detonate.
      if (now - entity.spawnedAt > this.config.tntLifetimeMs) this.explode(entity);
    }
  }

  /** Place one TNT sprite at (x, y) — the pickaxe's position — and start its fuse. */
  private spawnAt(x: number, y: number, p: PendingSpawn): void {
    const def = TNT_BY_KIND.get(p.kind);
    if (!def) return; // §136: unknown kind would be a config validation failure
    const sprite = this.spritePool.pop() ?? this.scene.add.image(0, 0, def.textureKey);
    sprite.setTexture(def.textureKey);
    sprite.setActive(true).setVisible(true).setPosition(x, y);
    sprite.setDepth(7); // below the pickaxe (8): both occupy the same spot
    sprite.clearTint();

    const now = this.getNowMs();
    const entity: TntEntity = {
      sprite,
      kind: p.kind,
      lifecycle: "CREATED",
      fuseAt: now + def.fuseMs,
      fuseTotalMs: def.fuseMs,
      spawnedAt: now,
      ownerId: p.ownerId,
      isNukeBurst: p.isNukeBurst,
    };
    transitionTnt(entity, "ARMED");
    this.entities.push(entity);

    // §26 attribution: hold ~3 s, fade ~0.5 s — only for viewer-owned TNT.
    if (p.ownerId.length > 0) {
      this.labels.show(x, y - this.config.blockSizePx * 0.7, p.ownerId, now);
    }
  }

  /**
   * §25/§27: apply the explosion EXACTLY once — only from ARMED (fuse burnt). Damages
   * blocks within the radius with falloff via the pure selector + ChunkManager.damageCell;
   * spawns a budgeted particle burst, requests a budgeted shake, retires the entity.
   * NEVER iterates other TNT entities (§28: chain reactions are structurally absent).
   */
  private explode(entity: TntEntity): void {
    if (!transitionTnt(entity, "TRIGGERED")) return; // second call is refused (§25)
    transitionTnt(entity, "EXPLODING");
    const def = TNT_BY_KIND.get(entity.kind)!;
    const now = this.getNowMs();
    const x = entity.sprite.x;
    const y = entity.sprite.y;

    // §27 spatial filter: only the bounding box of the circle is inspected, and the
    // pure selector emits only cells inside the circle inside the world column.
    const blockSize = this.config.blockSizePx;
    const worldBottomRow = Math.ceil(
      (this.scene.cameras.main.scrollY + this.config.height + def.radiusPx) / blockSize,
    );
    const cells = explosionCells({
      centerX: x,
      centerY: y,
      radiusPx: def.radiusPx,
      maxDamage: def.damage,
      blockSizePx: blockSize,
      minCol: 0,
      maxCol: this.config.chunkWidth - 1,
      minRow: 0,
      maxRow: worldBottomRow,
      chunkIdForRow: (row, rowsPerChunk) => Math.floor(row / rowsPerChunk),
      rowsPerChunk: this.config.chunkHeight,
    });
    for (const c of cells) {
      this.chunkManager.damageCell(c.chunkId, c.col, c.row, c.damage, now);
    }

    // §27/§30 effects, all budgeted: particles (pool-capped), shake (budget-clamped).
    // NUKE burst accounting is EXACT (§30): support spawns share (maxNukeParticles −
    // nukeShare) evenly; the nuke itself takes the remainder — total ≤ maxNukeParticles.
    const nukeShare = Math.max(1, Math.floor(this.config.maxNukeParticles / this.config.maxNukeTnt));
    const burstCount = !entity.isNukeBurst
      ? def.particles
      : entity.kind === "nuke"
        ? Math.max(1, this.config.maxNukeParticles - nukeShare * (this.config.maxNukeTnt - 1))
        : nukeShare;
    this.particles.burst(x, y, burstCount, TINTS[entity.kind]!, now, 700);
    this.camera.shake(def.shakeDurationMs, def.shakeIntensityPx);

    this.retire(entity);
  }

  /** EXPLODING → DONE: return the sprite to the pool (§20). */
  private retire(entity: TntEntity): void {
    transitionTnt(entity, "DONE");
    entity.sprite.clearTint();
    entity.sprite.setActive(false).setVisible(false);
    this.spritePool.push(entity.sprite);
    const idx = this.entities.indexOf(entity);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  destroy(): void {
    this.pending = [];
    this.nukeQueued = 0;
    for (const e of this.entities) e.sprite.destroy();
    this.entities.length = 0;
    for (const s of this.spritePool) s.destroy();
    this.spritePool.length = 0;
  }
}

/** Exported for tests: lifecycle type re-export (§25). */
export type { TntLifecycle };
