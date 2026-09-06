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
