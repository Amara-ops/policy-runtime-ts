## Policy Runtime TS

[![CI](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml)

## What it is (plain English)
This is a small runtime that enforces guardrails for agent treasuries while they execute transactions. Think of it as a lightweight circuit‑breaker: you describe what is allowed (addresses/functions), whether the system can be paused, and how much can flow out per hour/day. The runtime answers “allow” or “deny” for a requested action, and keeps append‑only logs so you can audit decisions and usage over time.

It complements CI-time checks from the Policy Linter by enforcing rules at execution time.
- Policy Linter (CI): https://github.com/Amara-ops/agent-guardrails-policy-linter
- Policy Linter Action (GitHub Marketplace Action): https://github.com/Amara-ops/policy-linter-action

## Quickstart (5 minutes)
1) Build and run the HTTP sidecar (binds to 127.0.0.1 by default)
- npm i && npm run build
- node examples/http_server.mjs  # http://127.0.0.1:8787

2) Evaluate an intent (allow)
- curl -sS -X POST http://127.0.0.1:8787/evaluate \
  -H 'Content-Type: application/json' \
  -d @examples/intent.sample.json | jq .

3) Evaluate a deny (exceed cap)
- curl -sS -X POST http://127.0.0.1:8787/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"chainId":8453,"to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","selector":"0xa9059cbb","denomination":"BASE_USDC","amount":"900000"}' | jq .

4) Execute (atomically evaluate + record)
- curl -sS -X POST http://127.0.0.1:8787/execute \
  -H 'Content-Type: application/json' \
  -d @examples/intent.sample.json | jq .

5) See usage/headroom
- npm run cli:status

Minimal integrate (evaluate → send → record)
- Pseudocode with viem/ethers:

```
const policyUrl = 'http://127.0.0.1:8787';
const intent = { chainId: 8453, to, selector, denomination: 'BASE_USDC', amount };

const ev = await fetch(policyUrl + '/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent }) }).then(r => r.json());
if (ev.action !== 'allow') throw new Error('Denied: ' + ev.reasons.join(','));

// ... send tx with your wallet client ...
// const txHash = await walletClient.writeContract({ address: to, abi, functionName, args });

await fetch(policyUrl + '/record', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent, txHash }) });
```

## Features
- Allowlist (chainId, to, selector)
- Global pause
- Caps: max_outflow_h1, max_outflow_d1 (per-denomination; default BASE_USDC)
- Per-function rate cap: max_per_function_h1 (optional, count per selector per hour)
- Per-target caps (optional): caps.per_target.{h1,d1} keyed by to or to|selector
- Decision headroom: global and per-target remaining values exposed for observability/debugging
- JSONL audit logging (append-only)
- HTTP: policy reload via POST /reload; log rotate via SIGHUP; optional Bearer auth token
- Observability: GET /metrics (Prometheus text format; minimal baseline)
- Intent filters (optional): deadline_ms, nonce_max_gap (with intent.nonce/prev_nonce), slippage_max_bps (with intent.slippage_bps)

## Intent model (quick note)
- to = the contract being called (target address on the transaction), not the end recipient of funds.
  - ERC‑20 transfer: to = USDC contract; selector = 0xa9059cbb; the recipient is the first calldata arg.
  - Native ETH transfer: the to address is the recipient EOA; selector is empty (no calldata). Native handling will be documented when added.
  - Router swap: to = router (e.g., Uniswap); selector = swap function.
- Per‑recipient limits are available via per‑target caps; allowlist gates by contract+function; caps apply to the provided amount.

## API
- loadPolicy(policy, policyHash)
- evaluate(intent) -> Decision
- recordExecution({intent, txHash, amount?})
- setPause(paused)

## Setup
- npm i
- npm run build

## Examples
- node examples/basic.mjs
- node examples/basic_from_json.mjs

## HTTP sidecar example
- npm run serve
  - Starts on http://127.0.0.1:8787 using examples/policy.v0_3.sample.json
  - CLI uses same data/log paths and the same policy hash (computed from policy), so counters are shared

## HTTP endpoints
- POST /evaluate { intent }
- POST /record { intent, txHash, amount? }
- POST /pause { paused: boolean }
- POST /execute { intent, txHash? }  // evaluate then, if allow, record
- POST /reload { policy } // validate, compute new hash and swap
- GET /metrics // Prometheus text format (baseline)

## CLI (after build)
- npm run cli:simulate -- examples/policy.v0_3.sample.json examples/intent.sample.json
- npm run cli:status  # shows global and per-target headroom for configured caps

## Troubleshooting
- NOT_ALLOWLISTED: ensure chainId/to/selector match and addresses are lowercased.
- CAP_*_EXCEEDED: lower amount or raise caps; check Decision.headroom/target_headroom for remaining.
- DEADLINE_EXPIRED: set a future deadline_ms.
- NONCE_GAP_EXCEEDED / NONCE_REGRESSION: align intent.nonce and prev_nonce.
- SLIPPAGE_EXCEEDED: lower intent.slippage_bps or raise policy.meta.slippage_max_bps.
- PAUSED: unpause via POST /pause { paused: false } or edit policy and /reload.
- 401 Unauthorized: set Authorization: Bearer <token> header to match the server authToken.

## Policy additions (v0.3)
- Per-denomination caps via CapAmount (string or per-denom map); defaultDenomination support
- Per-target caps caps.per_target.{h1,d1} by to or to|selector
- Decision target_headroom returns remaining per-target values (h1/d1) when a per-target cap applies
- HTTP policy reload to support hot updates with hash continuity
- Log rotate friendly: send SIGHUP to reopen logs
- Metrics endpoint to expose minimal runtime info for scraping
- Intent filters: deadline (deadline_ms), nonce gap (meta.nonce_max_gap + intent.nonce/prev_nonce), slippage limit (meta.slippage_max_bps + intent.slippage_bps)

## References
- Base mainnet USDC (BASE_USDC) contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Base chainId: 8453

## Example intent.json
{
  "chainId": 8453,
  "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "selector": "0xa9059cbb",
  "denomination": "BASE_USDC",
  "amount": "500",
  "deadline_ms": 1734100000000,
  "nonce": 42,
  "prev_nonce": 42,
  "slippage_bps": 30
}
