import type { CapAmount, CounterStore, Decision, DecisionTargetHeadroom, Intent, Policy } from './types.js';
import { inAllowlist, validatePolicy } from './policy.js';
import { toBigIntDecimal, humanToBaseUnits } from './util/amount.js';
import { opId as makeOpId } from './util/id.js';
import { getDenominationInfo } from './util/denom.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function key(prefix: string, suffix: string) { return `${prefix}:${suffix}`; }
function resolveCap(cap: CapAmount | undefined, denom: string): bigint | undefined {
  if (cap === undefined) return undefined;
  if (typeof cap === 'string') return BigInt(cap);
  const v = (cap as any)[denom];
  if (v === undefined) return undefined;
  if (typeof v === 'string') return BigInt(v);
  const nested = v as Record<string, string>;
  const nv = nested[denom];
  return nv !== undefined ? BigInt(nv) : undefined;
}

function resolvePerTarget(map: Record<string, CapAmount> | undefined, to: string, selector: string, denom: string): { limit?: bigint; keySuffix?: string; rawKey?: string } {
  if (!map) return {};
  const keySel = `${to}|${selector}`;
  const rawKey = (map[keySel] !== undefined) ? keySel : (map[to] !== undefined ? to : undefined);
  if (!rawKey) return {};
  const raw = map[rawKey]!;
  const lim = resolveCap(raw, denom);
  if (lim === undefined) return {};
  const suffix = rawKey === keySel ? `toSel:${keySel}:${denom}` : `to:${to}:${denom}`;
  return { limit: lim, keySuffix: suffix, rawKey };
}

export class PolicyEngine {
  private policy!: Policy;
  private policyHash: string = '';

  constructor(private store: CounterStore, private logger?: { append: (e: any) => Promise<void> }) {}

  loadPolicy(policy: unknown, policyHash: string) {
    this.policy = validatePolicy(policy);
    this.policyHash = policyHash;
  }

  private resolveAmountBaseUnits(intent: Intent, denom: string): bigint {
    // Prefer explicit base-unit amount if provided
    if (intent.amount !== undefined) {
      const base = toBigIntDecimal(intent.amount);
      if (intent.amount_human !== undefined) {
        const di = getDenominationInfo(denom, this.policy.meta?.denominations);
        const conv = humanToBaseUnits(intent.amount_human, di.decimals);
        if (conv !== base) throw new Error('AMOUNT_MISMATCH');
      }
      return base;
    }
    if (intent.amount_human !== undefined) {
      const di = getDenominationInfo(denom, this.policy.meta?.denominations);
      return humanToBaseUnits(intent.amount_human, di.decimals);
    }
    throw new Error('AMOUNT_REQUIRED');
  }

  async evaluate(intent: Intent, now: number = Date.now()): Promise<Decision> {
    const reasons: string[] = [];

    // Early denies (paused / deadline / nonce gap / slippage / not allowlisted)
    if (this.policy.pause) {
      await this.logDecision({ intent, now, decision: 'deny', reasons: ['PAUSED'] });
      return { action: 'deny', reasons: ['PAUSED'] };
    }
    if (intent.deadline_ms && now > intent.deadline_ms) {
      await this.logDecision({ intent, now, decision: 'deny', reasons: ['DEADLINE_EXPIRED'] });
      return { action: 'deny', reasons: ['DEADLINE_EXPIRED'] };
    }
    const maxGap = this.policy.meta?.nonce_max_gap;
    if (typeof maxGap === 'number' && intent.nonce !== undefined && intent.prev_nonce !== undefined) {
      if (intent.nonce < intent.prev_nonce) {
        await this.logDecision({ intent, now, decision: 'deny', reasons: ['NONCE_REGRESSION'] });
        return { action: 'deny', reasons: ['NONCE_REGRESSION'] };
      }
      if (intent.nonce - intent.prev_nonce > maxGap) {
        await this.logDecision({ intent, now, decision: 'deny', reasons: ['NONCE_GAP_EXCEEDED'] });
        return { action: 'deny', reasons: ['NONCE_GAP_EXCEEDED'] };
      }
    }
    const slipMax = this.policy.meta?.slippage_max_bps;
    if (typeof slipMax === 'number' && intent.slippage_bps !== undefined) {
      if (intent.slippage_bps > slipMax) {
        await this.logDecision({ intent, now, decision: 'deny', reasons: ['SLIPPAGE_EXCEEDED'] });
        return { action: 'deny', reasons: ['SLIPPAGE_EXCEEDED'] };
      }
    }
    if (!inAllowlist(this.policy.allowlist, intent.chainId, intent.to, intent.selector)) {
      await this.logDecision({ intent, now, decision: 'deny', reasons: ['NOT_ALLOWLISTED'] });
      return { action: 'deny', reasons: ['NOT_ALLOWLISTED'] };
    }

    const denom = intent.denomination ?? (this.policy.meta?.defaultDenomination ?? 'BASE_USDC');
    let amt: bigint;
    try { amt = this.resolveAmountBaseUnits(intent, denom); }
    catch (e: any) {
      const code = e?.message === 'AMOUNT_REQUIRED' ? 'AMOUNT_REQUIRED' : (e?.message === 'AMOUNT_MISMATCH' ? 'AMOUNT_MISMATCH' : 'BAD_AMOUNT');
      await this.logDecision({ intent, now, decision: 'deny', reasons: [code] });
      return { action: 'deny', reasons: [code] };
    }

    const _denomInfo = getDenominationInfo(denom, this.policy.meta?.denominations);

    // Caps (global per-denomination via CapAmount)
    const h1 = resolveCap(this.policy.caps?.max_outflow_h1, denom);
    const d1 = resolveCap(this.policy.caps?.max_outflow_d1, denom);
    const perFnH1 = (this.policy.caps as any).max_calls_per_function_h1 ?? this.policy.caps?.max_per_function_h1;
    const perFnD1 = (this.policy.caps as any).max_calls_per_function_d1;

    let h1Used = 0n, d1Used = 0n;
    let perFnUsedH1 = 0, perFnUsedD1 = 0;

    if (h1 !== undefined) {
      const w = await this.store.getWindow(key(this.policyHash, `${denom}:h1`), HOUR_MS, now);
      h1Used = w.used + amt;
      if (h1Used > h1) reasons.push('CAP_H1_EXCEEDED');
    }
    if (d1 !== undefined) {
      const w = await this.store.getWindow(key(this.policyHash, `${denom}:d1`), DAY_MS, now);
      d1Used = w.used + amt;
      if (d1Used > d1) reasons.push('CAP_D1_EXCEEDED');
    }
    if (perFnH1 !== undefined) {
      const w = await this.store.getWindow(key(this.policyHash, `fn:${intent.selector}:h1`), HOUR_MS, now);
      perFnUsedH1 = Number(w.used) + 1;
      if (perFnUsedH1 > perFnH1) reasons.push('CAP_PER_FUNCTION_H1_EXCEEDED');
    }
    if (perFnD1 !== undefined) {
      const w = await this.store.getWindow(key(this.policyHash, `fn:${intent.selector}:d1`), DAY_MS, now);
      perFnUsedD1 = Number(w.used) + 1;
      if (perFnUsedD1 > perFnD1) reasons.push('CAP_PER_FUNCTION_D1_EXCEEDED');
    }

    // v0.3: Per-target caps; values can be string or per-denom map. Counters are per denomination.
    const perTarget = this.policy.caps?.per_target;
    const targetHeadroom: DecisionTargetHeadroom = {};

    const h1Target = resolvePerTarget(perTarget?.h1, intent.to, intent.selector, denom);
    if (h1Target.limit !== undefined && h1Target.keySuffix) {
      const w = await this.store.getWindow(key(this.policyHash, `${h1Target.keySuffix}:h1`), HOUR_MS, now);
      const used = w.used + amt;
      const remaining = h1Target.limit - used;
      targetHeadroom.h1 = { key: h1Target.rawKey!, remaining: remaining.toString() };
      if (used > h1Target.limit) reasons.push('CAP_TARGET_H1_EXCEEDED');
    }

    const d1Target = resolvePerTarget(perTarget?.d1, intent.to, intent.selector, denom);
    if (d1Target.limit !== undefined && d1Target.keySuffix) {
      const w = await this.store.getWindow(key(this.policyHash, `${d1Target.keySuffix}:d1`), DAY_MS, now);
      const used = w.used + amt;
      const remaining = d1Target.limit - used;
      targetHeadroom.d1 = { key: d1Target.rawKey!, remaining: remaining.toString() };
      if (used > d1Target.limit) reasons.push('CAP_TARGET_D1_EXCEEDED');
    }

    if (reasons.length) {
      await this.logDecision({ intent, now, decision: 'deny', reasons, counters: { h1_used: h1Used?.toString(), d1_used: d1Used?.toString(), per_fn_h1_used: perFnUsedH1 }, headroom: { h1: h1 !== undefined ? (h1 - (h1Used)).toString() : undefined, d1: d1 !== undefined ? (d1 - (d1Used)).toString() : undefined, per_fn_h1: perFnH1 !== undefined ? Math.max(0, perFnH1 - perFnUsedH1) : undefined } });
      return { action: 'deny', reasons, target_headroom: Object.keys(targetHeadroom).length ? targetHeadroom : undefined };
    }

    const headroom = {
      h1: h1 !== undefined ? (h1 - h1Used).toString() : undefined,
      d1: d1 !== undefined ? (d1 - d1Used).toString() : undefined,
      per_fn_h1: perFnH1 !== undefined ? Math.max(0, perFnH1 - perFnUsedH1) : undefined,
      per_fn_d1: perFnD1 !== undefined ? Math.max(0, perFnD1 - perFnUsedD1) : undefined,
    };

    await this.logDecision({ intent, now, decision: 'allow', reasons: [], counters: { h1_used: h1Used.toString(), d1_used: d1Used.toString(), per_fn_h1_used: perFnUsedH1 }, headroom });
    return { action: 'allow', reasons: [], headroom, target_headroom: Object.keys(targetHeadroom).length ? targetHeadroom : undefined };
  }

  async recordExecution(meta: { intent: Intent; txHash: string; amount?: string; amount_human?: string }, now: number = Date.now()): Promise<void> {
    const denom = meta.intent.denomination ?? (this.policy.meta?.defaultDenomination ?? 'BASE_USDC');
    let amt: bigint;
    if (meta.amount !== undefined) {
      amt = toBigIntDecimal(meta.amount);
    } else if (meta.amount_human !== undefined) {
      const di = getDenominationInfo(denom, this.policy.meta?.denominations);
      amt = humanToBaseUnits(meta.amount_human, di.decimals);
    } else if (meta.intent.amount !== undefined) {
      amt = toBigIntDecimal(meta.intent.amount);
    } else if (meta.intent.amount_human !== undefined) {
      const di = getDenominationInfo(denom, this.policy.meta?.denominations);
      amt = humanToBaseUnits(meta.intent.amount_human, di.decimals);
    } else {
      throw new Error('AMOUNT_REQUIRED');
    }

    if (this.policy.caps?.max_outflow_h1) {
      await this.store.add(key(this.policyHash, `${denom}:h1`), amt, HOUR_MS, now);
    }
    if (this.policy.caps?.max_outflow_d1) {
      await this.store.add(key(this.policyHash, `${denom}:d1`), amt, DAY_MS, now);
    }
    const perFnH1 = (this.policy.caps as any).max_calls_per_function_h1 ?? this.policy.caps?.max_per_function_h1;
    const perFnD1 = (this.policy.caps as any).max_calls_per_function_d1;
    if (perFnH1 !== undefined) {
      await this.store.add(key(this.policyHash, `fn:${meta.intent.selector}:h1`), 1n, HOUR_MS, now);
    }
    if (perFnD1 !== undefined) {
      await this.store.add(key(this.policyHash, `fn:${meta.intent.selector}:d1`), 1n, DAY_MS, now);
    }
    const perTarget = this.policy.caps?.per_target;
    const h1Target = resolvePerTarget(perTarget?.h1, meta.intent.to, meta.intent.selector, denom);
    if (h1Target.keySuffix) {
      await this.store.add(key(this.policyHash, `${h1Target.keySuffix}:h1`), amt, HOUR_MS, now);
    }
    const d1Target = resolvePerTarget(perTarget?.d1, meta.intent.to, meta.intent.selector, denom);
    if (d1Target.keySuffix) {
      await this.store.add(key(this.policyHash, `${d1Target.keySuffix}:d1`), amt, DAY_MS, now);
    }

    if (this.logger) {
      await this.logger.append({ ts: now, type: 'execution', policyHash: this.policyHash, intent: meta.intent, txHash: meta.txHash, amount: amt.toString() });
    }
  }

  setPause(paused: boolean) {
    this.policy.pause = paused;
  }

  private async logDecision(args: { intent: Intent; now: number; decision: 'allow'|'deny'|'escalate'; reasons: string[]; counters?: { h1_used?: string; d1_used?: string; per_fn_h1_used?: number }; headroom?: { h1?: string; d1?: string; per_fn_h1?: number; per_fn_d1?: number } }) {
    if (!this.logger) return;
    const { intent, now, decision, reasons, counters, headroom } = args;
    const id = makeOpId(this.policyHash, intent);
    await this.logger.append({
      ts: now,
      type: 'decision',
      policyHash: this.policyHash,
      opId: id,
      decision,
      reasons,
      intent,
      paused: !!this.policy.pause,
      counters,
      headroom
    });
  }
}
