# Policy Runtime TS v0.3.0

Highlights
- Per‑denomination caps and defaultDenomination (BASE_USDC by default)
- Per‑target caps (to or to|selector) with decision target_headroom
- Intent filters: deadline_ms, nonce_max_gap (with intent.nonce/prev_nonce), slippage_max_bps (with intent.slippage_bps)
- Operational controls: POST /reload for hot policy swap, SIGHUP to reopen logs, GET /metrics for basic Prometheus counters
- CLI: policy-status shows global usage and per-target headroom

Changes
- Multi‑denomination scaffolding via meta.denominations and meta.defaultDenomination; backward‑compatible defaults preserved
- Optional per‑target caps via caps.per_target.{h1,d1}; headroom included in Decision.target_headroom
- /execute endpoint (from v0.2) retained; Decision.headroom exposes global remaining h1/d1 and per‑function headroom (if configured)
- HTTP: POST /reload validates and swaps policy atomically with new hash; server handles SIGHUP to reopen JSONL logs for logrotate
- GET /metrics exposes minimal counters (policy_runtime_decisions_total, by action)
- Filters: deadline_ms; nonce gap guard via meta.nonce_max_gap + intent.nonce/prev_nonce; slippage guard via meta.slippage_max_bps + intent.slippage_bps
- CLI status reports per‑target remaining headroom for any configured per_target caps

Upgrade notes
- No breaking changes expected for v0.2 users. Existing policies work unchanged.
- To use new features:
  - Add meta.defaultDenomination and optionally meta.denominations
  - Add caps.per_target.{h1,d1} entries keyed by to or to|selector
  - Optionally set meta.nonce_max_gap and/or meta.slippage_max_bps; callers may pass intent.nonce/prev_nonce and intent.slippage_bps

References
- Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- Sample policy: examples/policy.v0_3.sample.json

Compare
- https://github.com/Amara-ops/policy-runtime-ts/compare/v0.2.0...v0.3.0
