## Policy Runtime TS

[![CI](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml)

What this is (human‑friendly)
- A small HTTP sidecar that enforces spending and rate limits for your agent or wallet. You send it an "intent" that describes the planned on‑chain call. It replies "allow" or "deny" and logs every decision.
- Use it as a circuit breaker around your transaction sender. It’s simple, explicit, and auditable.

Core concepts
- Allowlist: Which contract (to) + function (selector) on which chainId are permitted.
- Caps: Limits on outflow amounts and/or call counts over rolling windows (hour/day), globally, per target, or per function selector.
- Denominations: A registry that tells the runtime how to convert human amounts (e.g., "1.25" USDC) into base units using decimals.

Quick start
1) Build and run the HTTP sidecar
- npm i && npm run build
- node examples/http_server.mjs  # http://127.0.0.1:8787

2) Evaluate an intent (allow)
- curl -sS -X POST http://127.0.0.1:8787/evaluate -H 'content-type: application/json' -d '{"intent":{"chainId":8453,"to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","selector":"0xa9059cbb","denomination":"BASE_USDC","amount_human":"1"}}' | jq .

3) Execute (evaluate + record)
- curl -sS -X POST http://127.0.0.1:8787/execute -H 'content-type: application/json' -d '{"intent":{"chainId":8453,"to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","selector":"0xa9059cbb","denomination":"BASE_USDC","amount_human":"1"}}' | jq .

4) Observe
- curl -sS http://127.0.0.1:8787/metrics
- npm run cli:status

Define a policy (explanatory)
- allowlist: Array of { chainId, to, selector }. Requests must match one entry.
- caps:
  - max_outflow_h1 / max_outflow_d1: Monetary limits per denomination. Use per‑denomination maps so you can write human amounts:
    "max_outflow_h1": { "BASE_USDC": "100" }   # $100 per hour
    "max_outflow_d1": { "BASE_USDC": "500" }  # $500 per day
    The runtime converts these to base units using meta.denominations[denom].decimals.
  - per_target.h1 / per_target.d1: Monetary limits scoped to a target key:
    - Key formats: "<to>" (aggregate per contract) or "<to>|<selector>" (per function on that contract).
    - Values: either base‑units string, or per‑denomination map using human strings (preferred).
  - max_calls_per_function_h1 / max_calls_per_function_d1: Call‑count limits per 4‑byte selector (not monetary). Pure integers.
- pause: If true, all requests are denied with PAUSED.
- meta:
  - denominations: Map denomination name to { decimals, chainId?, address? }. Used for amount_human conversions.
  - defaultDenomination: Used when an intent omits denomination.
  - nonce_max_gap / slippage_max_bps: Optional guardrails used with the corresponding intent fields.

Intent shape
- chainId: EVM chain id (e.g., 8453 for Base mainnet)
- to: Target contract address (lowercase)
- selector: 4‑byte function selector (0x + 8 hex). For ERC‑20 transfer it’s 0xa9059cbb.
- denomination: One of the registered denominations (e.g., BASE_USDC)
- amount or amount_human: Provide either base units (amount) or human (amount_human). If you provide both, they must match exactly or you’ll get AMOUNT_MISMATCH.
- Optional filters: deadline_ms, nonce/prev_nonce (with meta.nonce_max_gap), slippage_bps (with meta.slippage_max_bps)

Per‑target resolution
- Given (to, selector): runtime first checks per_target["to|selector"], else falls back to per_target["to"].

Function meaning
- "Function" here means a 4‑byte selector across all contracts. max_calls_per_function_* limits total requests for that selector per window, globally.

Human amounts and denominations (clear rules)
- Any monetary cap written as a per‑denomination map uses human strings and is normalized to base units at load time.
- Top‑level cap strings (without a map) are treated as base units for backward compatibility.
- Intent.amount_human follows the same decimals from meta.denominations; precision beyond decimals is rejected.

HTTP endpoints
- POST /evaluate { intent }
- POST /record { intent, txHash, amount? }
- POST /execute { intent, txHash? }
- POST /reload { policy }
- POST /pause { paused }
- GET /status
- GET /metrics

Troubleshooting
- NOT_ALLOWLISTED: chainId/to/selector mismatch.
- CAP_*_EXCEEDED: lower amount, increase caps, or wait for window to roll.
- AMOUNT_*: fix amount or denomination.
- DEADLINE_/NONCE_/SLIPPAGE_: adjust intent or meta.*.
- PAUSED: unpause via /pause or reload with pause=false.

Examples
- See examples/policy.v0_3.sample.json and policy_linter/samples/* for human‑cap examples.

Changelog highlights
- v0.3.3: Human caps in policy.json (per‑denomination), normalization at load time.
- v0.3.4: Aliases max_calls_per_function_{h1,d1}; per‑denomination normalization clarified; daily call caps supported.
