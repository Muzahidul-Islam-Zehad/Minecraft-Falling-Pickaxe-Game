/**
 * Camera controller (master spec §22).
 * Gameplay motion must never cause shake; shakes are explicit, clamped to configured
 * duration/intensity budgets, and never stack — a request while shaking is ignored.
 *
 * Depends only on the shake surface of a Phaser camera so it stays unit-testable.
 */
import type { GameConfig } from "@mef/config";

export interface ShakeCapableCamera {
  shake(durationMs: number, intensityPx: number): unknown;
  shakeEffect?: { isRunning?: boolean; stop?: () => void };
}

export class CameraController {
  private shakeUntil = 0;

  constructor(
    private readonly camera: ShakeCapableCamera,
    private readonly config: GameConfig,
  ) {}

  /** True while a budgeted shake is in progress. */
  get isShaking(): boolean {
    return performance.now() < this.shakeUntil || this.camera.shakeEffect?.isRunning === true;
  }

  /**
   * Request a screen shake for events like TNT/MEGA/NUKE (§22, §29, §30).
   * Duration and intensity are clamped to config budgets; requests during an active
   * shake are ignored (no infinite stacking).
   * @returns true when the shake was accepted.
   */
  shake(durationMs: number, intensityPx: number): boolean {
    if (!Number.isFinite(durationMs) || !Number.isFinite(intensityPx)) return false;
    if (durationMs <= 0 || intensityPx <= 0) return false;
    if (this.isShaking) return false;

    const duration = Math.min(durationMs, this.config.shakeDurationMaxMs);
    const intensity = Math.min(intensityPx, this.config.shakeIntensityMaxPx);
    this.shakeUntil = performance.now() + duration;
    this.camera.shake(duration, intensity);
    return true;
  }

  /** Immediately end any active shake. */
  stop(): void {
    this.shakeUntil = 0;
    this.camera.shakeEffect?.stop?.();
  }
}
