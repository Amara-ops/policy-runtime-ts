/* eslint-disable */
import http from 'node:http';
import { startServer } from '../http/server.js';
import { computePolicyHash } from '../util/policyHash.js';

declare const test: any, expect: any, beforeAll: any, afterAll: any;

const TEST_PORT = 8799;

const policy1 = {
  allowlist: [ { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb' } ],
  caps: { max_outflow_h1: { USDC: '1000' } },
  pause: false,
  meta: { defaultDenomination: 'USDC' }
};
const policy2 = {
  allowlist: [ { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb' } ],
  caps: { max_outflow_h1: { USDC: '2000' } },
  pause: true,
  meta: { defaultDenomination: 'USDC' }
};

let server: http.Server | undefined;

beforeAll(async () => {
  const res = await startServer({ policy: policy1, policyHash: computePolicyHash(policy1), port: TEST_PORT, host: '127.0.0.1' });
  if (!res.server) throw new Error('server failed to start');
  server = res.server;
});

afterAll(async () => {
  if (!server) return;
  await new Promise<void>(resolve => server!.close(() => resolve()))
});

async function post(path: string, body: any) {
  return await fetch(`http://127.0.0.1:${TEST_PORT}` + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function get(path: string) {
  return await fetch(`http://127.0.0.1:${TEST_PORT}` + path);
}

test('execute works', async () => {
  const r = await post('/execute', { intent: { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb', amount: '500' } });
  const j = await r.json();
  expect(j.action).toBe('allow');
});

test('reload swaps policy and hash', async () => {
  const r = await post('/reload', { policy: policy2 });
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(j.policyHash).toBe(computePolicyHash(policy2));

  // Now paused
  const r2 = await post('/evaluate', { intent: { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb', amount: '1' } });
  const j2 = await r2.json();
  expect(j2.action).toBe('deny');
  expect(j2.reasons).toContain('PAUSED');
});

test('metrics endpoint returns counters', async () => {
  const r = await get('/metrics');
  const t = await r.text();
  expect(t).toContain('policy_runtime_decisions_total');
  expect(t).toContain('policy_runtime_decisions_by_action_total');
});
