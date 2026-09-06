/**
 * Fixed-capacity ring buffer (master spec §126: every runtime collection must be bounded).
 * Preallocated backing array; pushing into a full buffer overwrites the oldest entry.
 * Avoids per-frame allocation and unbounded growth.
 */
export class RingBuffer<T> {
  private readonly items: Array<T | undefined>;
  private head = 0;
  private count = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error(`RingBuffer capacity must be >= 1, got ${capacity}`);
    }
    this.items = new Array<T | undefined>(capacity);
  }

  /** Current number of stored items (never exceeds capacity). */
  get size(): number {
    return this.count;
  }

  /** True when count === capacity. */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /** Insert an item; overwrites the oldest when full. */
  push(item: T): void {
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Item at logical index 0..size-1 (0 = oldest), or undefined. */
  at(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    const start = (this.head - this.count + this.capacity) % this.capacity;
    return this.items[(start + index) % this.capacity];
  }

  /** Most recently pushed item, or undefined when empty. */
  last(): T | undefined {
    return this.at(this.count - 1);
  }

  /** Remove all items without reallocating. */
  clear(): void {
    this.items.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}
