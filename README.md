## Policy Runtime TS

[![CI](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml)

## What this is
- An HTTP sidecar that enforces explicit, auditable guardrails for any agent or wallet.
- You send an Intent; it replies allow/deny and logs every decision. This reduces blast radius, prevents runaway spend, and creates a clear audit trail.
- Designed to be simple to reason about and easy to gate in CI: policies are just JSON; decisions are deterministic and logged.

## Core concepts
- Allowlist: Which contract (to) + function (selector) on which chainId are permitted.
- Caps: Limits on outflow amounts and call counts over rolling windows (hour/day), globally, per target, or per function selector.
- Denominations: Registry to convert human amounts (e.g., "1.25" USDC) into base units using decimals.

## Quick start
1) Build and run the HTTP sidecar
- npm i && npm run build
- node examples/http_server.mjs  
  (Server listens on http://127.0.0.1:8787)

2) Evaluate an intent (allow)
- curl -sS -X POST http://127.0.0.1:8787/evaluate -H 'content-type: application/json' -d '{"intent":{"chainId":8453,"to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","selector":"0xa9059cbb","denomination":"BASE_USDC","amount_human":"1"}}' | jq .

3) Send your transaction (with your wallet client)

4) Record the execution
- curl -sS -X POST http://127.0.0.1:8787/record -H 'content-type: application/json' -d '{"intent":{"chainId":8453,"to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","selector":"0xa9059cbb","denomination":"BASE_USDC","amount_human":"1"},"txHash":"0xREPLACE_WITH_YOUR_TX_HASH"}'

5) Observe
- curl -sS http://127.0.0.1:8787/metrics
- npm run cli:status

## Define a policy (explanatory)
- allowlist: Array of { chainId, to, selector }. Requests must match one entry.
- caps:
  - max_outflow_h1 / max_outflow_d1: Monetary limits per denomination per hour/day. Use per‑denomination maps to write human amounts:
  ```
  {
    "max_outflow_h1": { "BASE_USDC": "100" },
    "max_outflow_d1": { "BASE_USDC": "500" }
  }
  ```
    Runtime converts to base units using meta.denominations[denom].decimals.
  - per_target.h1 / per_target.d1: Monetary limits scoped to a target key:
    - Key formats: "\<to\>" (aggregate per contract) or "\<to\>|\<selector\>" (per function on that contract).
    - Values: base‑units string or per‑denomination map using human strings (preferred).
  - max_calls_per_function_h1 / max_calls_per_function_d1: Call‑count limits per 4‑byte selector (integers).
- pause: If true, all requests are denied with PAUSED.
- meta:
  - denominations: Map denomination name to { decimals, chainId?, address? }.
  - defaultDenomination: Used when an intent omits denomination.
  - nonce_max_gap / slippage_max_bps: Optional guardrails used with the corresponding intent fields.

## Intent shape
- chainId, to (lowercase), selector (0x + 8 hex), denomination.
- amount or amount_human. If both are provided, they must match or you get AMOUNT_MISMATCH.
- Optional: deadline_ms, nonce/prev_nonce, slippage_bps.

## Per‑target resolution
- Given (to, selector): first check per_target["to|selector"], else fall back to per_target["to"].

## Function meaning
- "Function" means a 4‑byte selector across all contracts. max_calls_per_function_h1 or max_calls_per_function_d1 limits total requests for that selector per hour/day, globally.

## Human amounts and denominations
- Any monetary cap written as a per‑denomination map uses human strings and is normalized to base units at load time.
- Top‑level cap strings (without a map) are treated as base units for backward compatibility.
- Intent.amount_human follows the same decimals; precision beyond decimals is rejected.

## Use with the Policy Linter
- See: https://github.com/Amara-ops/agent-guardrails-policy-linter
- Validate your `policy.json` with the linter before loading it into the runtime to catch schema and safety issues early.
- Recommended flow: edit policy → run the linter → commit/CI gate → (re)start the runtime (or `POST /reload`).
- GitHub Action: `agent-guardrails-policy-linter` provides a composite action to block merges on errors.
- CLI example (from the linter repo):
  - npm run build
  - node dist/cli.js path/to/policy.json --report report.json [--sarif report.sarif]

## Auth
- If AUTH_TOKEN is set when starting the server, all HTTP endpoints require header: authorization: Bearer \<token\>.
- If AUTH_TOKEN is not set, auth is disabled for local development only. Do not run without auth in shared or production environments.

## HTTP endpoints
- POST /evaluate { intent }
- POST /record { intent, txHash, amount? }
- POST /execute { intent, txHash? }
- POST /reload { policy }
- POST /pause { paused }
- GET /status
- GET /metrics

## Troubleshooting
- 401/403: Missing or wrong Bearer token when AUTH_TOKEN is enabled.
- NOT_ALLOWLISTED: chainId/to/selector mismatch.
- CAP_*_EXCEEDED: lower amount, increase caps, or wait for window to roll.
- AMOUNT_*: fix amount or denomination.
- DEADLINE_/NONCE_/SLIPPAGE_: adjust intent or meta.*.
- PAUSED: unpause via /pause or reload with pause=false.

## Changelog highlights
- v0.3.3: Human caps in policy.json (per‑denomination), normalization at load time.
- v0.3.4: Aliases max_calls_per_function_{h1,d1}; per‑denomination normalization clarified; daily call caps supported.
