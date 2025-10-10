import type { CounterStore, CounterWindow } from '../types.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

function bucketStart(now: number, windowMs: number): number {
  return now - (now % windowMs);
}

interface Entry { used: string; windowStart: number }
interface FileShape { counters: Record<string, Entry> }

export class FileCounterStore implements CounterStore {
  private map = new Map<string, { used: bigint; windowStart: number }>();
  constructor(private filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as FileShape;
      const rec = parsed?.counters ?? {};
      for (const [k, v] of Object.entries(rec)) {
        this.map.set(k, { used: BigInt(v.used), windowStart: v.windowStart });
      }
    } catch (_) {
      // fresh start
      this.map.clear();
    }
  }

  private flush(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const out: FileShape = { counters: {} };
    for (const [k, v] of this.map.entries()) {
      out.counters[k] = { used: v.used.toString(), windowStart: v.windowStart };
    }
    const tmp = this.filePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(out));
    writeFileSync(this.filePath, JSON.stringify(out)); // simple fallback if rename not desired
  }

  async persist(): Promise<void> { this.flush(); }

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
    this.flush();
  }
}
