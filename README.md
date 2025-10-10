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

Examples
- node examples/basic.mjs
- node examples/basic_from_json.mjs

CLI (after build)
- policy-simulate <policy.json> <intent.json>
- policy-status

Example intent.json
{
  "chainId": 8453,
  "to": "0x0000000000000000000000000000000000000001",
  "selector": "0xaaaaaaaa",
  "denomination": "BASE_USDC",
  "amount": "500"
}
