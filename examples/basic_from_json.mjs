import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../dist/index.js';
import fs from 'node:fs/promises';

async function main() {
  const policy = JSON.parse(await fs.readFile(new URL('./policy.sample.json', import.meta.url)));

  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger('./logs/decisions.jsonl');
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, '0x' + 'bb'.repeat(32));

  const intent = {
    chainId: 8453,
    to: '0x0000000000000000000000000000000000000001',
    selector: '0xaaaaaaaa',
    denomination: 'BASE_USDC',
    amount: '750'
  };

  console.log('Decision A');
  const a = await engine.evaluate(intent);
  console.log(a);
  if (a.action === 'allow') await engine.recordExecution({ intent, txHash: '0x10' });

  console.log('Decision B');
  const b = await engine.evaluate(intent);
  console.log(b);
}

main().catch((e) => { console.error(e); process.exit(1); });
