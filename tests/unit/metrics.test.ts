import { describe, expect, it } from "vitest";
import { MetricsTracker } from "../../apps/game/src/game/systems/MetricsTracker";

/** MetricsTracker tests (master spec §71, §96). */

describe("MetricsTracker (master spec §71, §96)", () => {
  it("returns zeroed snapshot when empty", () => {
    const m = new MetricsTracker(10);
    const snap = m.getSnapshot();
    expect(snap.samples).toBe(0);
    expect(snap.fpsAvg).toBe(0);
    expect(snap.fpsMin).toBe(0);
    expect(snap.fpsMax).toBe(0);
  });

  it("computes avg fps over the window", () => {
    const m = new MetricsTracker(10);
    [16.67, 16.60, 16.74].forEach((ft) => m.sample(ft)); // all ~60 fps
    const snap = m.getSnapshot();
    expect(snap.samples).toBe(3);
    expect(snap.fpsAvg).toBeGreaterThan(59);
    expect(snap.fpsAvg).toBeLessThan(61);
  });

  it("tracks min and max fps", () => {
    const m = new MetricsTracker(10);
    [10, 20, 30].forEach((ft) => m.sample(ft)); // 100 / 50 / 33.3 fps
    const snap = m.getSnapshot();
    expect(snap.fpsMin).toBeCloseTo(33.33, 1);
    expect(snap.fpsMax).toBeCloseTo(100, 1);
  });

  it("tracks worst frame time in the window", () => {
    const m = new MetricsTracker(10);
    [16, 17, 50, 16].forEach((ft) => m.sample(ft));
    expect(m.getSnapshot().frameTimeMaxMs).toBe(50);
  });

  it("ignores non-finite and non-positive deltas", () => {
    const m = new MetricsTracker(10);
    m.sample(Number.NaN);
    m.sample(0);
    m.sample(-5);
    expect(m.getSnapshot().samples).toBe(0);
  });

  it("clamps extreme deltas to 1s so tab-switch spikes do not poison the window", () => {
    const m = new MetricsTracker(2);
    m.sample(16.7); // ~60 fps
    m.sample(5000); // clamps to 1000ms -> 1 fps
    const snap = m.getSnapshot();
    expect(snap.fpsMin).toBeCloseTo(1, 5);
    expect(snap.fpsAvg).toBeCloseTo((1 + 1000 / 16.7) / 2, 5);
  });

  it("reset() empties the window", () => {
    const m = new MetricsTracker(10);
    m.sample(16.7);
    m.reset();
    expect(m.getSnapshot().samples).toBe(0);
  });
});
