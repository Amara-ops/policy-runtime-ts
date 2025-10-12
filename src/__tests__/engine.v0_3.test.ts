/* eslint-disable */
import { PolicyEngine, MemoryCounterStore } from '../index.js';
import type { Intent } from '../types.js';

declare const test: any, expect: any;

const policy = {
  allowlist: [
    { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb' }
  ],
  meta: {
    defaultDenomination: 'BASE_USDC',
    denominations: {
      BASE_USDC: { decimals: 6, chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
      BASE_ETH: { decimals: 18, chainId: 8453 }
    }
  },
  caps: {
    max_outflow_h1: { BASE_USDC: '1000', BASE_ETH: '100000000000000000' },
    max_outflow_d1: { BASE_USDC: '2000', BASE_ETH: '200000000000000000' },
    per_target: {
      h1: { '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': '800' },
      d1: { '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913|0xa9059cbb': '1500' }
    }
  },
  pause: false
};

function phash() { return '0x' + '22'.repeat(32); }

const iUSDC: Intent = { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb', denomination: 'BASE_USDC', amount: '500' };
const iETH: Intent = { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb', denomination: 'BASE_ETH', amount: '50000000000000000' };

test('per-denomination caps isolate usage', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy(policy, phash());

  const now = Date.now();
  const r1 = await eng.evaluate(iUSDC, now);
  expect(r1.action).toBe('allow');
  await eng.recordExecution({ intent: iUSDC, txHash: '0xaaa' }, now);

  const r2 = await eng.evaluate(iETH, now);
  expect(r2.action).toBe('allow');
});

test('per-target caps enforce to and to|selector', async () => {
  const store = new MemoryCounterStore();
  const eng = new PolicyEngine(store);
  eng.loadPolicy(policy, phash());
  const now = Date.now();

  const r1 = await eng.evaluate({ ...iUSDC, amount: '700' }, now);
  expect(r1.action).toBe('deny');
  expect(r1.reasons).toContain('CAP_TARGET_H1_EXCEEDED');

  const r2 = await eng.evaluate({ ...iUSDC, amount: '900' }, now);
  expect(r2.action).toBe('deny');
  expect(r2.reasons).toContain('CAP_TARGET_D1_EXCEEDED');
});
