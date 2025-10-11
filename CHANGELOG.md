# Changelog

## 0.2.0
- Add /execute endpoint (evaluate then record when allowed).
- Add per-function rate cap: caps.max_per_function_h1 (count per selector per hour), with logging and headroom.
- Update schema, tests, README, and sample policy.
- Add CI workflow (Node 20, build + test on push/PR).

## 0.1.0
- MVP complete: engine (allowlist, pause, h1/d1 caps), file/memory stores, JSONL logging.
- CLI (simulate/status), HTTP sidecar (/evaluate, /record, /pause), tests.
- Stable policy hash; CLI and server share counters/logs.
- Atomic file store writes.

## 0.0.1 (internal)
- Initial local iteration before GitHub push.
