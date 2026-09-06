/**
 * Pooled explosion particles (master spec §20, §74, §27).
 * Hard budget: the pool NEVER holds more than maxParticles live entities — requests
 * beyond the budget are dropped (§74 policy: drop, don't grow). All motion is capped
 * every tick (§70) and every particle dies by lifetime — nothing persists.
 */
import Phaser from "phaser";
import type { GameConfig } from "@mef/config";

interface ParticleSprite extends Phaser.Physics.Arcade.Image {
  dieAt?: number;
}

export class ParticlePool {
  private readonly group: Phaser.Physics.Arcade.Group;
  private live = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: GameConfig,
  ) {
    // maxSize enforces the §74 budget at the Phaser level too — belt and braces.
    this.group = this.scene.physics.add.group({ maxSize: this.config.maxParticles });
  }

  get activeCount(): number {
    return this.live;
  }

  /**
   * Spawn a burst. Returns how many particles were actually spawned (≤ count;
   * the rest were dropped because the budget was full — §74).
   */
  burst(
    x: number,
    y: number,
    count: number,
    tint: number,
    nowMs: number,
    lifetimeMs: number,
  ): number {
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      if (this.live >= this.config.maxParticles) break; // budget: drop, never grow
      const p = this.group.get(x, y, "boom-particle") as ParticleSprite | null;
      if (!p) break; // group maxSize reached
      p.setActive(true).setVisible(true).setPosition(x, y);
      p.setTexture("boom-particle");
      p.setTint(tint);
      p.setDepth(9);
      // Random radial velocity, capped by the §70 cap.
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      const cap = this.config.pickaxeMaxVelocityPxPerSec;
      const vx = Math.max(-cap, Math.min(cap, Math.cos(angle) * speed));
      const vy = Math.max(-cap, Math.min(cap, Math.sin(angle) * speed - 60));
      p.setVelocity(vx, vy);
      (p.body as Phaser.Physics.Arcade.Body | null)?.setAllowGravity(true);
      p.dieAt = nowMs + lifetimeMs * (0.6 + Math.random() * 0.4);
      this.live++;
      spawned++;
    }
    return spawned;
  }

  /** Per-frame tick: lifetime expiry + velocity caps (§70, §74). */
  update(deltaMs: number, nowMs: number): void {
    void deltaMs;
    const cap = this.config.pickaxeMaxVelocityPxPerSec;
    for (const p of this.group.getChildren() as ParticleSprite[]) {
      if (!p.active) continue;
      const body = p.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        body.velocity.x = Math.max(-cap, Math.min(cap, body.velocity.x));
        body.velocity.y = Math.max(-cap, Math.min(cap, body.velocity.y));
      }
      if (p.dieAt !== undefined && nowMs >= p.dieAt) this.kill(p);
    }
  }

  private kill(p: ParticleSprite): void {
    p.setActive(false).setVisible(false);
    p.body?.stop();
    this.group.killAndHide(p);
    this.live = Math.max(0, this.live - 1);
  }

  destroy(): void {
    this.group.destroy(true);
    this.live = 0;
  }
}
