import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../dist/index.js';

async function main() {
  const policy = {
    allowlist: [
      { chainId: 8453, to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', selector: '0xa9059cbb' }
    ],
    caps: { max_outflow_h1: '1000', max_outflow_d1: '2000' },
    pause: false
  };

  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger('./logs/decisions.jsonl');
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, '0x' + 'aa'.repeat(32));

  const intent = {
    chainId: 8453,
    to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    selector: '0xa9059cbb',
    denomination: 'BASE_USDC',
    amount: '500'
  };

  console.log('Evaluate #1');
  const r1 = await engine.evaluate(intent);
  console.log(r1);
  if (r1.action === 'allow') await engine.recordExecution({ intent, txHash: '0x01' });

  console.log('Evaluate #2');
  const r2 = await engine.evaluate(intent);
  console.log(r2);
  if (r2.action === 'allow') await engine.recordExecution({ intent, txHash: '0x02' });

  console.log('Evaluate #3 (should exceed h1 cap)');
  const r3 = await engine.evaluate(intent);
  console.log(r3);
}

main().catch((e) => { console.error(e); process.exit(1); });
