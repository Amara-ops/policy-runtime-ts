Policy Runtime TS (MVP)

Minimal policy engine for agent treasury guardrails.

Features (v0)
- Allowlist (chainId, to, selector)
- Global pause
- Caps: max_outflow_h1, max_outflow_d1 (single denomination: BASE_USDC)
- JSONL audit logging (append-only)

API
- loadPolicy(policy, policyHash)
- evaluate(intent) -> Decision
- recordExecution({intent, txHash, amount?})
- setPause(paused)

Setup
- npm i
- npm run build

Example
import { PolicyEngine, MemoryCounterStore } from './dist/index.js'

const policy = { allowlist:[{chainId:8453,to:'0x..',selector:'0x..'}], caps:{max_outflow_h1:'1000000'} };
const engine = new PolicyEngine(new MemoryCounterStore());
engine.loadPolicy(policy, '0xhash');
const dec = await engine.evaluate({chainId:8453,to:'0x..',selector:'0x..',denomination:'BASE_USDC',amount:'500'});
if (dec.action==='allow') await engine.recordExecution({intent:{...}, txHash:'0x1'});
