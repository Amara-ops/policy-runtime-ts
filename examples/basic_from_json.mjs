import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../dist/index.js';
import fs from 'node:fs/promises';

async function main() {
  const policy = JSON.parse(await fs.readFile(new URL('./policy.sample.json', import.meta.url)));

  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger('./logs/decisions.jsonl');
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, '0x' + 'bb'.repeat(32));

  const intentUSDC = {
    chainId: 8453,
    to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    selector: '0xa9059cbb',
    denomination: 'BASE_USDC',
    amount_human: '1.5'
  };

  console.log('Decision USDC');
  const a = await engine.evaluate(intentUSDC);
  console.log(a);
  if (a.action === 'allow') await engine.recordExecution({ intent: intentUSDC, txHash: '0x10' });

  const intentETH = {
    chainId: 8453,
    to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    selector: '0xa9059cbb',
    denomination: 'BASE_ETH',
    amount_human: '0.05'
  };

  console.log('Decision ETH');
  const b = await engine.evaluate(intentETH);
  console.log(b);
  if (b.action === 'allow') await engine.recordExecution({ intent: intentETH, txHash: '0x11' });
}

main().catch((e) => { console.error(e); process.exit(1); });
