/* eslint-disable */
import { PolicyEngine, MemoryCounterStore } from '../index.js';
import type { Intent } from '../types.js';

declare const test: any, expect: any;

const basePolicy = {
  allowlist: [
    { chainId: 8453, to: '0x0000000000000000000000000000000000000001', selector: '0xaaaaaaaa' }
  ],
  caps: { max_outflow_h1: '1000', max_outflow_d1: '2000' },
  pause: false
};

const intent: Intent = {
  chainId: 8453,
  to: '0x0000000000000000000000000000000000000001',
  selector: '0xaaaaaaaa',
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
