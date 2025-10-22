import { readFileSync } from 'node:fs';
import { PolicyEngine, MemoryCounterStore } from '../index.js';
import { computePolicyHash } from '../util/policyHash.js';
import { normalizeAndValidatePolicy } from '../policy.js';

function loadJson(path: string) { return JSON.parse(readFileSync(path, 'utf8')); }

async function main() {
  const [policyPath, intentPath] = process.argv.slice(2);
  if (!policyPath || !intentPath) {
    console.error('usage: npm run cli:simulate -- <policy.json> <intent.json>');
    process.exit(1);
  }
  const pRaw = loadJson(policyPath);
  const p = normalizeAndValidatePolicy(pRaw);
  const policyHash = computePolicyHash(p);
  const engine = new PolicyEngine(new MemoryCounterStore());
  engine.loadPolicy(p, policyHash);
  const intent = loadJson(intentPath);
  const dec = await engine.evaluate(intent);
  console.log(JSON.stringify(dec, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
