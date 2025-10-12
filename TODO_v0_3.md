v0.3 roadmap (working document)

Scope
1) Multi-denomination support
- Add denomination registry (symbol -> decimals, chain -> token address optional)
- Schema: policy.meta.denomination -> policy.meta.denominations[] with a default
- Engine: counters keyed per-denomination; amount normalization by decimals
- CLI/Server: accept denomination; validate; default to BASE_USDC
- Samples: add BASE_USDC + ETH examples; migration notes
- Tests: multi-denom caps; rollover; mixed-intent denial when denom missing

2) Per-target caps
- Add caps per to and per to+selector (h1/d1 and optional count)
- Engine: additional counters; headroom reporting per-target
- Schema + samples + tests

3) Intent filters
- max_slippage_bps, deadline window, nonce monotonicity (doc-only for ETH for now)
- Engine: enforce filters; examples for transfer/swap
- Tests: deny on violating filters

4) Log management
- SIGHUP-based log reopen; README notes for logrotate

5) Policy reload
- Safe hot-reload (CLI + HTTP /reload); audit log on reload; hash continuity

6) Observability
- Optional /metrics endpoint (Prometheus text), minimal set: decisions_total{action}, spend_used_h1/d1 per denom, per_fn_h1_used

Milestones
- M1: Multi-denomination skeleton merged behind defaults (no behavior change)
- M2: Engine + tests enforcing per-denom caps
- M3: Per-target caps end-to-end
- M4: Filters + docs
- M5: Reload + logs + metrics

Acceptance criteria (M2)
- Given policy with denominations [BASE_USDC(6), BASE_ETH(18)] and caps per denom, intents are allowed/denied per their denom; counters don’t cross-contaminate.
- Backward compatibility: single-denom policies work unchanged.
