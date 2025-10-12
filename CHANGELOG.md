# Changelog

## v0.3.0 (WIP)
- Multi-denomination scaffolding: denomination registry (meta.denominations), defaultDenomination support, backward-compatible defaults (BASE_USDC).
- Per-target caps: optional caps.per_target.{h1,d1} keyed by to or to|selector.
- Docs: clarified Intent.to semantics; README example intent uses Base USDC address + transfer selector.

## v0.2.0
- /execute endpoint for atomic evaluate+record.
- Per-function rate cap caps.max_per_function_h1 with logging and headroom.
- CI workflow added; README polish; sample policy updates.
