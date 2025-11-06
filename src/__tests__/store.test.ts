/* eslint-disable */
import { MemoryCounterStore } from '../store/memoryStore.js';

declare const it: any, expect: any;

function bucket(now: number, windowMs: number) { return now - (now % windowMs); }

const HOUR = 3600_000;

it('rolls over hourly buckets', async () => {
  const store = new MemoryCounterStore();
  const key = 'k:USDC:h1';
  const t0 = bucket(Date.now(), HOUR);
  await store.add(key, 100n, HOUR, t0 + 1_000);
  let w = await store.getWindow(key, HOUR, t0 + 1_000);
  expect(w.used).toBe(100n);

  // next hour
  const t1 = t0 + HOUR;
  w = await store.getWindow(key, HOUR, t1 + 1_000);
  expect(w.used).toBe(0n);
});
