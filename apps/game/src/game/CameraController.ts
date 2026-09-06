/**
 * Camera controller (master spec §22).
 * All camera movement routes through here. Vertical follow is a DOWNWARD RATCHET:
 * the camera holds still while the pickaxe is above the screen middle, engages once it
 * digs past the middle (+ dead zone), then eases so the pickaxe rides at the middle —
 * and NEVER scrolls back up. Tiny physics motion (strike hops, rebounds) therefore
 * cannot jitter the view at all: upward motion is structurally dead.
 *
 * Depends only on the shake/scroll surface of a Phaser camera so it stays unit-testable.
 */
import type { GameConfig } from "@mef/config";

export interface ShakeCapableCamera {
  shake(durationMs: number, intensityPx: number): unknown;
  shakeEffect?: { isRunning?: boolean; stop?: () => void };
  /** Vertical scroll — the controller's ratchet state lives here. */
  scrollY?: number;
}

export class CameraController {
  private shakeUntil = 0;
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
  }

  /** True while a budgeted shake is in progress. */
  get isShaking(): boolean {
    return this.now() < this.shakeUntil || this.camera.shakeEffect?.isRunning === true;
  }

  /**
   * §22 downward-ratchet follow (call once per frame).
   * @param targetY World Y of the followed entity (raw pickaxe position).
   * @param deltaMs Frame delta for frame-rate-independent smoothing.
   * @param viewportHeight Camera viewport height (screen middle = scrollY + h/2).
   *
   * Behavior: desired scroll keeps the entity exactly at screen middle. While the
   * entity is at/above the middle (within the dead zone) the camera HOLDS. Once the
   * entity digs past middle + deadZone, the camera eases toward it (never above the
   * current scroll — the ratchet). Rebounds, strike hops, and respawns above the view
   * therefore never move the camera up.
   */
  followDown(targetY: number, deltaMs: number, viewportHeight: number): void {
    if (!Number.isFinite(targetY) || !(viewportHeight > 0)) return;
    const current = this.camera.scrollY ?? 0;
    const desired = targetY - viewportHeight * 0.5;
    if (desired <= current + this.deadZone) return; // hold: at/above middle (± dead zone)
    const t = Math.min(1, (deltaMs / 1000) * this.lerpPerSec);
    const eased = current + (desired - current) * t;
    this.camera.scrollY = Math.max(current, eased); // ratchet: never scroll up
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
