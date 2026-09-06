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

describe("CameraController.followDown (§22: downward ratchet, hold-until-middle)", () => {
  const H = 800; // viewport height for the tests
  function makeFollowCam(scrollY = 0): { cam: ShakeCapableCamera & { scrollY: number } } {
    return { cam: { shake: vi.fn(), scrollY } };
  }

  it("HOLDS while the pickaxe is above the screen middle", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.followDown(H * 0.3, 16, H); // pickaxe at 30% of the screen
    expect(cam.scrollY).toBe(0);
  });

  it("HOLDS while the pickaxe is at the middle within the dead zone", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    // middle = H/2 = 400; dead zone 6 → up to 406 holds.
    ctrl.followDown(H / 2 + DEFAULT_GAME_CONFIG.cameraDeadZonePx - 1, 16, H);
    expect(cam.scrollY).toBe(0);
  });

  it("ENGAGES once the pickaxe digs past middle + dead zone, easing downward", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.followDown(H / 2 + DEFAULT_GAME_CONFIG.cameraDeadZonePx + 100, 16, H);
    const t = Math.min(1, 0.016 * DEFAULT_GAME_CONFIG.cameraFollowLerpPerSec);
    const desired = H / 2 + DEFAULT_GAME_CONFIG.cameraDeadZonePx + 100 - H / 2;
    expect(cam.scrollY).toBeCloseTo(desired * t, 5);
  });

  it("converges to keeping the pickaxe at the screen middle (within the dead zone)", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    const pickaxeY = 3000;
    for (let i = 0; i < 400; i++) ctrl.followDown(pickaxeY, 16, H);
    // The ratchet holds once the pickaxe is within the dead zone of the middle, so it
    // settles AT middle or up to deadZone short of it — never past, never above.
    const middleScroll = pickaxeY - H / 2;
    expect(cam.scrollY).toBeLessThanOrEqual(middleScroll);
    expect(cam.scrollY).toBeGreaterThanOrEqual(middleScroll - DEFAULT_GAME_CONFIG.cameraDeadZonePx - 1);
  });

  it("NEVER scrolls back up (ratchet): rebounds/hops/respawns above middle hold", () => {
    const { cam } = makeFollowCam(0);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    // Dig deep first.
    const pickaxeY = 3000;
    for (let i = 0; i < 400; i++) ctrl.followDown(pickaxeY, 16, H);
    const settled = cam.scrollY;
    expect(settled).toBeGreaterThan(0);
    // Pickaxe bounces UP 200px (strike hop / rebound / respawn above the view).
    for (let i = 0; i < 60; i++) ctrl.followDown(pickaxeY - 200, 16, H);
    expect(cam.scrollY).toBe(settled); // unchanged — upward motion is dead
  });

  it("is frame-rate independent: same total time → same convergence", () => {
    const a = makeFollowCam(0);
    const ctrlA = new CameraController(a.cam, DEFAULT_GAME_CONFIG);
    const b = makeFollowCam(0);
    const ctrlB = new CameraController(b.cam, DEFAULT_GAME_CONFIG);
    for (let i = 0; i < 60; i++) ctrlA.followDown(2000, 16.67, H); // ~1 s at 60 fps
    for (let i = 0; i < 30; i++) ctrlB.followDown(2000, 33.33, H); // ~1 s at 30 fps
    // Discrete exponential integration has O(dt) discretization error: require the
    // two paths to agree within 1% of the distance covered, not exact equality.
    expect(Math.abs(b.cam.scrollY - a.cam.scrollY)).toBeLessThan(0.01 * 1000);
  });

  it("ignores non-finite targets and invalid viewports (§70 hygiene)", () => {
    const { cam } = makeFollowCam(10);
    const ctrl = new CameraController(cam, DEFAULT_GAME_CONFIG);
    ctrl.followDown(Number.NaN, 16, H);
    ctrl.followDown(500, 16, 0);
    expect(cam.scrollY).toBe(10);
  });
});
