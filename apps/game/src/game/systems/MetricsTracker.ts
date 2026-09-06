/**
 * Rolling performance measurement (master spec §71, §96).
 * Bounded sample window; averages/min/max computed on demand — no per-frame allocation.
 */
import { RingBuffer } from "./RingBuffer";

export interface MetricsSnapshot {
  /** Average FPS over the window. */
  fpsAvg: number;
  fpsMin: number;
  fpsMax: number;
  /** Average frame time in ms over the window. */
  frameTimeAvgMs: number;
  /** Worst frame time in ms in the window (spike detector). */
  frameTimeMaxMs: number;
  /** Number of samples currently held (<= window size). */
  samples: number;
}

export class MetricsTracker {
  private readonly frameTimes: RingBuffer<number>;
  private readonly fpsValues: RingBuffer<number>;

  constructor(private readonly windowSize = 60) {
    this.frameTimes = new RingBuffer<number>(windowSize);
    this.fpsValues = new RingBuffer<number>(windowSize);
  }

  /**
   * Record one frame. Delta is clamped so tab-switch spikes don't poison the window (§70).
   * @param frameDeltaMs raw Phaser update delta in ms
   */
  sample(frameDeltaMs: number): void {
    if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0) return;
    const clamped = Math.min(frameDeltaMs, 1000);
    this.frameTimes.push(clamped);
    this.fpsValues.push(1000 / clamped);
  }

  getSnapshot(): MetricsSnapshot {
    let fpsSum = 0;
    let fpsMin = Number.POSITIVE_INFINITY;
    let fpsMax = 0;
    let ftSum = 0;
    let ftMax = 0;
    for (let i = 0; i < this.fpsValues.size; i++) {
      const fps = this.fpsValues.at(i) ?? 0;
      const ft = this.frameTimes.at(i) ?? 0;
      fpsSum += fps;
      if (fps < fpsMin) fpsMin = fps;
      if (fps > fpsMax) fpsMax = fps;
      ftSum += ft;
      if (ft > ftMax) ftMax = ft;
    }
    const n = this.fpsValues.size || 1;
    return {
      fpsAvg: fpsSum / n,
      fpsMin: Number.isFinite(fpsMin) ? fpsMin : 0,
      fpsMax,
      frameTimeAvgMs: ftSum / n,
      frameTimeMaxMs: ftMax,
      samples: this.fpsValues.size,
    };
  }

  reset(): void {
    this.frameTimes.clear();
    this.fpsValues.clear();
  }
}
