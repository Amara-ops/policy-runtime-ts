# Changelog

## v0.3.5 - 2025-11-05
- Symbol-based denominations (e.g., USDC, ETH). Decimals resolved via token registry (meta.tokens_registry_path or env TOKENS_CONFIG_PATH; fallback config/tokens.json).
- Backward compatibility: legacy meta.denominations and BASE_USDC still accepted; defaultDenomination honored if present.
- Per-target headroom: when both to and to|selector limits exist, returned target_headroom.key now prefers the more specific to|selector.
- Policy normalization: human caps converted using legacy decimals when available; otherwise left human for engine-time conversion using registry.
- Examples updated to use symbol keys and tokens_registry_path.

## v0.3.4 - 2025-10-24
- Human-amount caps with per‑denomination normalization at load time; top‑level strings remain base units for backward compat.
- Added `max_calls_per_function_h1` (alias for `max_per_function_h1`) and new `max_calls_per_function_d1` for daily call caps.
- Per‑target caps accept both `to` and `to|selector` keys; selector takes precedence.
- Policy hash computation updated to ignore undefined keys (aligns with JSON stringify) to avoid spurious hash diffs.
- Runtime process management: restart now replaces stale instance; clean handoff on start/stop; logs reopen on SIGHUP and `/reopen_logs`.
- Examples and README updated to v0.3.4 conventions; samples now use human amounts by default.

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
