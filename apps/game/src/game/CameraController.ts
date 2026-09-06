/**
 * Camera controller (master spec §22).
 * All camera movement routes through here: dead zone + smoothing so tiny physics
 * motion never jitters the view, plus budgeted non-stacking shake for events.
 *
 * Depends only on the shake/scroll surface of a Phaser camera so it stays unit-testable.
 */
import type { GameConfig } from "@mef/config";

export interface ShakeCapableCamera {
  shake(durationMs: number, intensityPx: number): unknown;
  shakeEffect?: { isRunning?: boolean; stop?: () => void };
  /** Optional scroll access so the controller can own follow behavior (§22). */
  scrollY?: number;
}

export class CameraController {
  private shakeUntil = 0;
  private targetY = 0;
  private readonly deadZone: number;
  private readonly lerpPerSec: number;
  private readonly now: () => number;

  constructor(
    private readonly camera: ShakeCapableCamera,
    private readonly config: GameConfig,
    /** Injectable clock for deterministic tests (defaults to performance.now). */
    now: () => number = () => performance.now(),
  ) {
    this.deadZone = config.cameraDeadZonePx;
    this.lerpPerSec = config.cameraFollowLerpPerSec;
    this.now = now;
    this.targetY = camera.scrollY ?? 0;
  }

  /** True while a budgeted shake is in progress. */
  get isShaking(): boolean {
    return this.now() < this.shakeUntil || this.camera.shakeEffect?.isRunning === true;
  }

  /**
   * §22 follow: apply the dead zone to the raw target, then smooth toward it.
   * Motion inside the dead zone is ignored entirely (no micro-jitter); motion outside
   * snaps the target to (value − deadZone) in the direction of travel and lerps the
   * real scroll toward it with a frame-rate-independent factor.
   * Call once per frame with the raw follow target.
   */
  follow(targetY: number, deltaMs: number): void {
    if (!Number.isFinite(targetY)) return;
    const delta = targetY - this.targetY;
    if (Math.abs(delta) > this.deadZone) {
      this.targetY = targetY - Math.sign(delta) * this.deadZone;
    }
    const t = Math.min(1, (deltaMs / 1000) * this.lerpPerSec);
    const current = this.camera.scrollY ?? 0;
    this.camera.scrollY = current + (this.targetY - current) * t;
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
    this.shakeUntil = this.now() + duration;
    this.camera.shake(duration, intensity);
    return true;
  }

  /** Immediately end any active shake. */
  stop(): void {
    this.shakeUntil = 0;
    this.camera.shakeEffect?.stop?.();
  }
}
