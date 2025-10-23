import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../dist/index.js';

async function main() {
  const policy = {
    allowlist: [
      { chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', selector: '0xa9059cbb' }
    ],
    meta: {
      schemaVersion: 'v0.3.4',
      defaultDenomination: 'BASE_USDC',
      denominations: {
        BASE_USDC: { decimals: 6, chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' }
      }
    },
    caps: {
      max_outflow_h1: { BASE_USDC: '100' },
      max_outflow_d1: { BASE_USDC: '500' },
      max_calls_per_function_h1: 60,
      max_calls_per_function_d1: 600
    },
    pause: false
  };

  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger('./logs/decisions.jsonl');
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, '0x' + 'aa'.repeat(32));

  const intent = {
    chainId: 8453,
    to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    selector: '0xa9059cbb',
    denomination: 'BASE_USDC',
    amount_human: '50'
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
