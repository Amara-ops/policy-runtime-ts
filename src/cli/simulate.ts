#!/usr/bin/env node
import fs from 'node:fs/promises';
import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../index.js';
import { computePolicyHash } from '../util/policyHash.js';

async function main() {
  const [,, policyPath, intentPath] = process.argv;
  if (!policyPath || !intentPath) {
    console.error('Usage: policy-simulate <policy.json> <intent.json>');
    process.exit(2);
  }
  const policy = JSON.parse(await fs.readFile(policyPath, 'utf8'));
  const intent = JSON.parse(await fs.readFile(intentPath, 'utf8'));

  const policyHash = computePolicyHash(policy);
  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger('./logs/decisions.jsonl');
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, policyHash);

  const decision = await engine.evaluate(intent);
  console.log(JSON.stringify(decision, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
