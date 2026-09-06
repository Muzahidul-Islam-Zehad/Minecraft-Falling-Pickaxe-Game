import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CameraController, type ShakeCapableCamera } from "../../apps/game/src/game/CameraController";
import { DEFAULT_GAME_CONFIG } from "@mef/config";

/** CameraController tests (master spec §22: bounded, non-stacking shake). */

function makeCamera(): {
  cam: ShakeCapableCamera;
  shakeMock: ReturnType<typeof vi.fn>;
  effect: { isRunning: boolean; stop: ReturnType<typeof vi.fn> };
} {
  const shakeMock = vi.fn();
  const effect = { isRunning: false, stop: vi.fn() };
  const cam: ShakeCapableCamera = {
    shake: shakeMock,
    shakeEffect: effect,
  };
  return { cam, shakeMock, effect };
}

describe("CameraController (master spec §22: bounded, non-stacking shake)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 }); // deterministic performance.now()
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a shake within budgets", () => {
    const { cam, shakeMock } = makeCamera();
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    expect(ctrl.shake(500, 6)).toBe(true);
    expect(shakeMock).toHaveBeenCalledWith(500, 6);
    expect(ctrl.isShaking).toBe(true);
  });

  it("clamps duration and intensity to configured budgets", () => {
    const { cam, shakeMock } = makeCamera();
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    expect(ctrl.shake(5000, 99)).toBe(true);
    expect(shakeMock).toHaveBeenCalledWith(
      DEFAULT_GAME_CONFIG.shakeDurationMaxMs,
      DEFAULT_GAME_CONFIG.shakeIntensityMaxPx,
    );
  });

  it("refuses a second shake while one is active (no infinite stacking, §22)", () => {
    const { cam, shakeMock } = makeCamera();
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    expect(ctrl.shake(500, 6)).toBe(true);
    expect(ctrl.shake(500, 6)).toBe(false);
    expect(shakeMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a new shake after the previous one expires", () => {
    const { cam, shakeMock } = makeCamera();
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.shake(500, 6);
    vi.advanceTimersByTime(DEFAULT_GAME_CONFIG.shakeDurationMaxMs + 1);
    expect(ctrl.isShaking).toBe(false);
    expect(ctrl.shake(200, 4)).toBe(true);
    expect(shakeMock).toHaveBeenCalledTimes(2);
  });

  it("refuses non-finite and non-positive values", () => {
    const { cam } = makeCamera();
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    expect(ctrl.shake(Number.NaN, 10)).toBe(false);
    expect(ctrl.shake(100, Number.POSITIVE_INFINITY)).toBe(false);
    expect(ctrl.shake(100, 0)).toBe(false);
    expect(ctrl.shake(-1, 10)).toBe(false);
  });

  it("stop() ends shake immediately", () => {
    const { cam, effect } = makeCamera();
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.shake(1000, 10);
    ctrl.stop();
    expect(ctrl.isShaking).toBe(false);
    expect(effect.stop).toHaveBeenCalledTimes(1);
  });
});

describe("CameraController.follow (§22: dead zone + smoothing, no jitter)", () => {
  function makeFollowCam(scrollY = 0): { cam: ShakeCapableCamera & { scrollY: number } } {
    return { cam: { shake: vi.fn(), scrollY } };
  }

  it("ignores motion inside the dead zone entirely (no micro-jitter)", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.follow(DEFAULT_GAME_CONFIG.cameraDeadZonePx - 1, 16);
    expect(cam.scrollY).toBe(0); // no movement: target stayed inside the zone
  });

  it("eases toward targets beyond the dead zone, stopping dead-zone short of them", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.follow(50, 16); // target 50 → internal target snaps to 50-6=44, lerp 8%/frame
    const expected = (50 - DEFAULT_GAME_CONFIG.cameraDeadZonePx) * Math.min(1, 0.016 * DEFAULT_GAME_CONFIG.cameraFollowLerpPerSec);
    expect(cam.scrollY).toBeCloseTo(expected, 5);
    for (let i = 0; i < 300; i++) ctrl.follow(50, 16);
    expect(cam.scrollY).toBeCloseTo(50 - DEFAULT_GAME_CONFIG.cameraDeadZonePx, 0);
  });

  it("is frame-rate independent: same total time → same convergence", () => {
    const a = makeFollowCam(0);
    const ctrlA = new CameraController(a.cam, DEFAULT_GAME_CONFIG);
    const b = makeFollowCam(0);
    const ctrlB = new CameraController(b.cam, DEFAULT_GAME_CONFIG);
    for (let i = 0; i < 60; i++) ctrlA.follow(500, 16.67); // ~1 s at 60 fps
    for (let i = 0; i < 30; i++) ctrlB.follow(500, 33.33); // ~1 s at 30 fps
    // Discrete exponential integration has O(dt) discretization error: require the
    // two paths to agree within 1% of the distance covered, not exact equality.
    expect(Math.abs(b.cam.scrollY - a.cam.scrollY)).toBeLessThan(0.01 * 500);
  });

  it("ignores non-finite targets (§70 hygiene)", () => {
    const { cam } = makeFollowCam(10);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.follow(Number.NaN, 16);
    expect(cam.scrollY).toBe(10);
  });
});
