import { describe, expect, it } from "vitest";
import { RingBuffer } from "../../apps/game/src/game/systems/RingBuffer";

/** RingBuffer tests (master spec §126: bounded collections, no unbounded growth). */

describe("RingBuffer (master spec §126)", () => {
  it("starts empty with size 0", () => {
    const rb = new RingBuffer<number>(4);
    expect(rb.size).toBe(0);
    expect(rb.last()).toBeUndefined();
  });

  it("stores and reads items in order", () => {
    const rb = new RingBuffer<number>(4);
    [10, 20, 30].forEach((n) => rb.push(n));
    expect([rb.at(0), rb.at(1), rb.at(2)]).toEqual([10, 20, 30]);
    expect(rb.last()).toBe(30);
  });

  it("overwrites oldest when full and maintains order after wraparound", () => {
    const rb = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => rb.push(n));
    expect([rb.at(0), rb.at(1), rb.at(2)]).toEqual([3, 4, 5]);
    expect(rb.last()).toBe(5);
  });

  it("clear() empties without reallocating", () => {
    const rb = new RingBuffer<string>(2);
    rb.push("a");
    rb.push("b");
    rb.clear();
    expect(rb.size).toBe(0);
    expect(rb.last()).toBeUndefined();
  });

  it("rejects non-positive capacity", () => {
    expect(() => new RingBuffer<number>(0)).toThrow(/capacity/);
    expect(() => new RingBuffer<number>(-2)).toThrow(/capacity/);
  });

  it("handles capacity 1", () => {
    const rb = new RingBuffer<string>(1);
    rb.push("a");
    rb.push("b");
    expect(rb.size).toBe(1);
    expect(rb.last()).toBe("b");
  });
});
