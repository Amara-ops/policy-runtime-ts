import type { CounterStore, CounterWindow } from '../types.js';

function bucketStart(now: number, windowMs: number): number {
  return now - (now % windowMs);
}

export class MemoryCounterStore implements CounterStore {
  private map = new Map<string, { used: bigint; windowStart: number }>();

  async load(): Promise<void> {}
  async persist(): Promise<void> {}

  async getWindow(key: string, windowMs: number, now: number): Promise<CounterWindow> {
    const start = bucketStart(now, windowMs);
    const entry = this.map.get(key);
    if (!entry || entry.windowStart !== start) return { used: 0n, windowStart: start };
    return { used: entry.used, windowStart: entry.windowStart };
  }

  async add(key: string, amount: bigint, windowMs: number, now: number): Promise<void> {
    const start = bucketStart(now, windowMs);
    const entry = this.map.get(key);
    if (!entry || entry.windowStart !== start) {
      this.map.set(key, { used: amount, windowStart: start });
    } else {
      entry.used += amount;
    }
  }
}
