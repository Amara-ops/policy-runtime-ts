# Changelog

## v0.3.0
- Multi-denomination scaffolding: denomination registry (meta.denominations), defaultDenomination support, backward-compatible defaults (BASE_USDC).
- Per-target caps: optional caps.per_target.{h1,d1} keyed by to or to|selector; headroom returned in decisions.
- /execute endpoint (from v0.2) retained; decisions now expose global headroom and per-target headroom.
- HTTP policy hot-reload via POST /reload; SIGHUP-based log reopen for logrotate.
- Observability: GET /metrics exposes basic counters.
- Intent filters (optional): deadline_ms, nonce gap guard (meta.nonce_max_gap + intent.nonce/prev_nonce), slippage guard (meta.slippage_max_bps + intent.slippage_bps).
- CLI status shows global usage and per-target headroom for configured caps.

## v0.2.0
- /execute endpoint for atomic evaluate+record.
- Per-function rate cap caps.max_per_function_h1 with logging and headroom.
- CI workflow added; README polish; sample policy updates.
