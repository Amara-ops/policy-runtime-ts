/* eslint-disable */
import { PolicyEngine, MemoryCounterStore } from '../index.js';
import type { Intent } from '../types.js';

declare const test: any, expect: any;

const basePolicy = {
  allowlist: [
    { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb' }
  ],
  caps: { max_outflow_h1: '1000', max_outflow_d1: '2000', max_per_function_h1: 2 },
  pause: false
};

const intent: Intent = {
  chainId: 8453,
  to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  selector: '0xa9059cbb',
  denomination: 'BASE_USDC',
  amount: '500'
};

function phash() { return '0x' + '11'.repeat(32); }

test('deny when paused', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  const pol = { ...basePolicy, pause: true };
  eng.loadPolicy(pol, phash());
  const res = await eng.evaluate(intent);
  expect(res.action).toBe('deny');
  expect(res.reasons).toContain('PAUSED');
});

test('deny when not allowlisted', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy({ ...basePolicy, allowlist: [] }, phash());
  const res = await eng.evaluate(intent);
  expect(res.action).toBe('deny');
  expect(res.reasons).toContain('NOT_ALLOWLISTED');
});

test('allow within caps, then deny when exceeding h1', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy(basePolicy, phash());
  const now = Date.now();

  const r1 = await eng.evaluate(intent, now);
  expect(r1.action).toBe('allow');
  await eng.recordExecution({ intent, txHash: '0x01' }, now);

  const r2 = await eng.evaluate(intent, now);
  expect(r2.action).toBe('allow');
  await eng.recordExecution({ intent, txHash: '0x02' }, now);

  const r3 = await eng.evaluate(intent, now);
  expect(r3.action).toBe('deny');
  expect(r3.reasons).toContain('CAP_H1_EXCEEDED');
});

test('per-function rate cap: allow twice then deny on third within 1h', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy(basePolicy, phash());
  const now = Date.now();

  const i = { ...intent, amount: '1' };
  for (let n = 0; n < 2; n++) {
    const r = await eng.evaluate(i, now);
    expect(r.action).toBe('allow');
    await eng.recordExecution({ intent: i, txHash: '0x0' + (n + 1) }, now);
  }
  const r3 = await eng.evaluate(i, now);
  expect(r3.action).toBe('deny');
  expect(r3.reasons).toContain('CAP_PER_FUNCTION_H1_EXCEEDED');
});
