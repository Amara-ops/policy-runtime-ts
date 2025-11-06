/* eslint-disable */
import { PolicyEngine, MemoryCounterStore } from '../index.js';
import type { Intent } from '../types.js';

declare const test: any, expect: any;

const policy = {
  allowlist: [
    { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb' }
  ],
  meta: {
    defaultDenomination: 'USDC',
    nonce_max_gap: 1,
    slippage_max_bps: 50
  },
  caps: {
    max_outflow_h1: { USDC: '1000', ETH: '0.1' },
    max_outflow_d1: { USDC: '2000', ETH: '0.2' },
    per_target: {
      h1: { '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { USDC: '800' } },
      d1: { '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913|0xa9059cbb': { USDC: '1500' } }
    }
  },
  pause: false
};

function phash() { return '0x' + '22'.repeat(32); }

const base: Intent = { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb', denomination: 'USDC', amount: '1' };

const iUSDC: Intent = { ...base, amount: '500' };
const iUSDC_human: Intent = { ...base, amount: undefined as any, amount_human: '0.0003' };
const iETH: Intent = { ...base, denomination: 'ETH', amount: '50000000000000000' };

test('per-denomination caps isolate usage and human amounts convert correctly', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy(policy, phash());

  const now = Date.now();
  const r0 = await eng.evaluate(iUSDC_human, now);
  expect(r0.action).toBe('allow');
  await eng.recordExecution({ intent: iUSDC_human, txHash: '0xhhh' }, now);

  const r1 = await eng.evaluate(iUSDC, now); // 300 + 500 = 800 (equal to per-target h1)
  expect(r1.action).toBe('allow');
  await eng.recordExecution({ intent: iUSDC, txHash: '0xaaa' }, now);

  const r2 = await eng.evaluate(iETH, now);
  expect(r2.action).toBe('allow');
});

test('per-target caps enforce to and to|selector and return target_headroom; deadline, nonce gap, and slippage filters work', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy(policy, phash());
  const now = Date.now();

  const r0 = await eng.evaluate({ ...iUSDC, amount: '700' }, now);
  expect(r0.action).toBe('allow');
  expect(r0.target_headroom?.h1?.key).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');

  const r1 = await eng.evaluate({ ...iUSDC, amount: '900' }, now);
  expect(r1.action).toBe('deny');
  expect(r1.reasons).toContain('CAP_TARGET_H1_EXCEEDED');
  expect(r1.target_headroom?.h1?.key).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');

  const r2 = await eng.evaluate({ ...iUSDC, amount: '1600' }, now);
  expect(r2.action).toBe('deny');
  expect(r2.reasons).toContain('CAP_TARGET_D1_EXCEEDED');
  expect(r2.target_headroom?.d1?.key).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913|0xa9059cbb');

  const r3 = await eng.evaluate({ ...iUSDC, deadline_ms: now - 1 }, now);
  expect(r3.action).toBe('deny');
  expect(r3.reasons).toContain('DEADLINE_EXPIRED');

  const r4 = await eng.evaluate({ ...iUSDC, nonce: 4, prev_nonce: 5 }, now);
  expect(r4.action).toBe('deny');
  expect(r4.reasons).toContain('NONCE_REGRESSION');

  const r5 = await eng.evaluate({ ...iUSDC, nonce: 7, prev_nonce: 5 }, now);
  expect(r5.action).toBe('deny');
  expect(r5.reasons).toContain('NONCE_GAP_EXCEEDED');

  const r6 = await eng.evaluate({ ...iUSDC, nonce: 5, prev_nonce: 5 }, now);
  expect(r6.action).toBe('allow');

  const r7 = await eng.evaluate({ ...iUSDC, slippage_bps: 100 }, now);
  expect(r7.action).toBe('deny');
  expect(r7.reasons).toContain('SLIPPAGE_EXCEEDED');

  const r8 = await eng.evaluate({ ...iUSDC, slippage_bps: 25 }, now);
  expect(r8.action).toBe('allow');
});
