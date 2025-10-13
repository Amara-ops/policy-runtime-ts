#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileCounterStore } from '../index.js';
import { computePolicyHash } from '../util/policyHash.js';

function fmt(n?: bigint) { return n !== undefined ? n.toString() : 'n/a'; }

async function main() {
  const policyPath = process.env.POLICY_PATH || path.resolve('examples/policy.v0_3.sample.json');
  const countersPath = './data/counters.json';
  const policyRaw = await fs.readFile(policyPath, 'utf8');
  const policy = JSON.parse(policyRaw);
  const policyHash = computePolicyHash(policy);

  const store = new FileCounterStore(countersPath);
  await store.load();

  const denom = policy.meta?.defaultDenomination || 'BASE_USDC';

  // Global headroom (h1/d1)
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const now = Date.now();

  let h1Used: bigint | undefined;
  let d1Used: bigint | undefined;
  if (policy.caps?.max_outflow_h1) {
    const w = await store.getWindow(`${policyHash}:${denom}:h1`, hour, now);
    h1Used = w.used;
  }
  if (policy.caps?.max_outflow_d1) {
    const w = await store.getWindow(`${policyHash}:${denom}:d1`, day, now);
    d1Used = w.used;
  }

  console.log('Policy status');
  console.log(`- Policy hash: ${policyHash}`);
  console.log(`- Denomination: ${denom}`);
  if (h1Used !== undefined) console.log(`- h1 used: ${fmt(h1Used)}`);
  if (d1Used !== undefined) console.log(`- d1 used: ${fmt(d1Used)}`);

  // Per-target headroom preview: list configured per_target caps and show remaining as limit - used
  const perT = policy.caps?.per_target;
  if (perT?.h1 || perT?.d1) {
    console.log('\nPer-target caps headroom:');
  }
  if (perT?.h1) {
    for (const [rawKey, cap] of Object.entries(perT.h1)) {
      const limit = typeof cap === 'string' ? BigInt(cap) : BigInt((cap as any)[denom] ?? 0);
      const suffix = `${rawKey.includes('|') ? 'toSel' : 'to'}:${rawKey}:${denom}:h1`;
      const w = await store.getWindow(`${policyHash}:${suffix}`, hour, now);
      const remaining = limit - w.used;
      console.log(`- h1 ${rawKey}: remaining ${remaining.toString()}`);
    }
  }
  if (perT?.d1) {
    for (const [rawKey, cap] of Object.entries(perT.d1)) {
      const limit = typeof cap === 'string' ? BigInt(cap) : BigInt((cap as any)[denom] ?? 0);
      const suffix = `${rawKey.includes('|') ? 'toSel' : 'to'}:${rawKey}:${denom}:d1`;
      const w = await store.getWindow(`${policyHash}:${suffix}`, day, now);
      const remaining = limit - w.used;
      console.log(`- d1 ${rawKey}: remaining ${remaining.toString()}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
