## Policy Runtime TS

[![CI](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Amara-ops/policy-runtime-ts/actions/workflows/ci.yml)

## What it is (plain English)
This is a small runtime that enforces guardrails for agent treasuries while they execute transactions. Think of it as a lightweight circuit‑breaker: you describe what is allowed (addresses/functions), whether the system can be paused, and how much can flow out per hour/day. The runtime answers “allow” or “deny” for a requested action, and keeps append‑only logs so you can audit decisions and usage over time.

It complements CI-time checks from the Policy Linter by enforcing rules at execution time.
- Policy Linter (CI): https://github.com/Amara-ops/agent-guardrails-policy-linter
- Policy Linter Action (GitHub Marketplace Action): https://github.com/Amara-ops/policy-linter-action

## Features
- Allowlist (chainId, to, selector)
- Global pause
- Caps: max_outflow_h1, max_outflow_d1 (single denomination: BASE_USDC)
- Per-function rate cap: max_per_function_h1 (optional, count per selector per hour)
- JSONL audit logging (append-only)

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
  - Starts on http://127.0.0.1:8787 using examples/policy.sample.json
  - CLI uses same data/log paths and the same policy hash (computed from policy), so counters are shared

## HTTP endpoints
- POST /evaluate { intent }
- POST /record { intent, txHash, amount? }
- POST /pause { paused: boolean }
- POST /execute { intent, txHash? }  // evaluate then, if allow, record

## CLI (after build)
- npm run cli:simulate -- examples/policy.sample.json examples/intent.sample.json
- npm run cli:status

## Policy additions (v0.2)
- caps.max_per_function_h1: integer >= 1; applies per selector per hour window

## References
- Base mainnet USDC (BASE_USDC) contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Base chainId: 8453

## Example intent.json
{
  "chainId": 8453,
  "to": "0x0000000000000000000000000000000000000001",
  "selector": "0xaaaaaaaa",
  "denomination": "BASE_USDC",
  "amount": "500"
}
