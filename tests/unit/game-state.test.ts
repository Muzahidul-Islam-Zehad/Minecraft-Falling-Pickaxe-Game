import { describe, expect, it, vi } from "vitest";
import { GameStateMachine } from "../../apps/game/src/game/systems/GameStateMachine";

/** GameStateMachine tests (master spec §65). */

describe("GameStateMachine (master spec §65)", () => {
  it("starts in BOOT", () => {
    expect(new GameStateMachine().current).toBe("BOOT");
  });

  it("allows the documented startup path", () => {
    const sm = new GameStateMachine();
    expect(sm.transition("LOADING")).toBe(true);
    expect(sm.transition("READY")).toBe(true);
    expect(sm.transition("RUNNING")).toBe(true);
    expect(sm.current).toBe("RUNNING");
  });

  it("supports pause/resume, stop, and reset via LOADING", () => {
    const sm = new GameStateMachine();
    sm.transition("LOADING");
    sm.transition("READY");
    sm.transition("RUNNING");
    expect(sm.transition("PAUSED")).toBe(true);
    expect(sm.transition("RUNNING")).toBe(true);
    expect(sm.transition("STOPPED")).toBe(true);
    expect(sm.transition("LOADING")).toBe(true); // §109 reset flow
    expect(sm.current).toBe("LOADING");
  });

  it("allows any running state to enter ERROR, and ERROR to recover to STOPPED", () => {
    const sm = new GameStateMachine();
    sm.transition("LOADING");
    sm.transition("READY");
    sm.transition("RUNNING");
    expect(sm.transition("ERROR")).toBe(true);
    expect(sm.current).toBe("ERROR");
    expect(sm.transition("STOPPED")).toBe(true);
  });

  it("refuses illegal transitions like BOOT -> RUNNING", () => {
    const sm = new GameStateMachine();
    expect(sm.transition("RUNNING")).toBe(false);
    expect(sm.current).toBe("BOOT");
  });

  it("refuses STOPPED -> RUNNING (reset must go through LOADING)", () => {
    const sm = new GameStateMachine();
    sm.force("STOPPED");
    expect(sm.transition("RUNNING")).toBe(false);
    expect(sm.current).toBe("STOPPED");
  });

  it("refuses RUNNING -> LOADING (world rebuild must be deliberate)", () => {
    const sm = new GameStateMachine();
    sm.transition("LOADING");
    sm.transition("READY");
    sm.transition("RUNNING");
    expect(sm.transition("LOADING")).toBe(false);
    expect(sm.current).toBe("RUNNING");
  });

  it("notifies listeners on successful transitions and supports unsubscribe", () => {
    const sm = new GameStateMachine();
    const listener = vi.fn();
    const off = sm.onChange(listener);
    sm.transition("LOADING");
    expect(listener).toHaveBeenCalledWith("BOOT", "LOADING");
    off();
    sm.transition("READY");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("force() bypasses validation for recovery", () => {
    const sm = new GameStateMachine();
    sm.force("ERROR");
    expect(sm.current).toBe("ERROR");
  });
});
