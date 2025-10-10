import type { CounterStore, Decision, Intent, Policy } from './types.js';
import { inAllowlist, validatePolicy } from './policy.js';
import { toBigIntDecimal } from './util/amount.js';
import { opId as makeOpId } from './util/id.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function key(prefix: string, denom: string) { return `${prefix}:${denom}`; }

export class PolicyEngine {
  private policy!: Policy;
  private policyHash: string = '';

  constructor(private store: CounterStore, private logger?: { append: (e: any) => Promise<void> }) {}

  loadPolicy(policy: unknown, policyHash: string) {
    this.policy = validatePolicy(policy);
    this.policyHash = policyHash;
  }

  async evaluate(intent: Intent, now: number = Date.now()): Promise<Decision> {
    const reasons: string[] = [];

    // Early denies (paused / not allowlisted)
    if (this.policy.pause) {
      await this.logDecision({ intent, now, decision: 'deny', reasons: ['PAUSED'] });
      return { action: 'deny', reasons: ['PAUSED'] };
    }
    if (!inAllowlist(this.policy.allowlist, intent.chainId, intent.to, intent.selector)) {
      await this.logDecision({ intent, now, decision: 'deny', reasons: ['NOT_ALLOWLISTED'] });
      return { action: 'deny', reasons: ['NOT_ALLOWLISTED'] };
    }

    const denom = intent.denomination ?? 'BASE_USDC';
    const amt = toBigIntDecimal(intent.amount);

    const h1 = this.policy.caps?.max_outflow_h1 ? BigInt(this.policy.caps.max_outflow_h1) : undefined;
    const d1 = this.policy.caps?.max_outflow_d1 ? BigInt(this.policy.caps.max_outflow_d1) : undefined;

    let h1Used = 0n, d1Used = 0n;

    if (h1 !== undefined) {
      const w = await this.store.getWindow(key(this.policyHash, denom + ':h1'), HOUR_MS, now);
      h1Used = w.used + amt;
      if (h1Used > h1) reasons.push('CAP_H1_EXCEEDED');
    }
    if (d1 !== undefined) {
      const w = await this.store.getWindow(key(this.policyHash, denom + ':d1'), DAY_MS, now);
      d1Used = w.used + amt;
      if (d1Used > d1) reasons.push('CAP_D1_EXCEEDED');
    }

    if (reasons.length) {
      await this.logDecision({ intent, now, decision: 'deny', reasons, counters: { h1_used: h1Used?.toString(), d1_used: d1Used?.toString() } });
      return { action: 'deny', reasons };
    }

    const headroom = {
      h1: h1 !== undefined ? (h1 - h1Used).toString() : undefined,
      d1: d1 !== undefined ? (d1 - d1Used).toString() : undefined
    };

    await this.logDecision({ intent, now, decision: 'allow', reasons: [], counters: { h1_used: h1Used.toString(), d1_used: d1Used.toString() }, headroom });
    return { action: 'allow', reasons: [], headroom };
  }

  async recordExecution(meta: { intent: Intent; txHash: string; amount?: string }, now: number = Date.now()): Promise<void> {
    const denom = meta.intent.denomination ?? 'BASE_USDC';
    const amt = toBigIntDecimal(meta.amount ?? meta.intent.amount);

    if (this.policy.caps?.max_outflow_h1) {
      await this.store.add(key(this.policyHash, denom + ':h1'), amt, HOUR_MS, now);
    }
    if (this.policy.caps?.max_outflow_d1) {
      await this.store.add(key(this.policyHash, denom + ':d1'), amt, DAY_MS, now);
    }

    if (this.logger) {
      await this.logger.append({ ts: now, type: 'execution', policyHash: this.policyHash, intent: meta.intent, txHash: meta.txHash, amount: amt.toString() });
    }
  }

  setPause(paused: boolean) {
    this.policy.pause = paused;
  }

  private async logDecision(args: { intent: Intent; now: number; decision: 'allow'|'deny'|'escalate'; reasons: string[]; counters?: { h1_used?: string; d1_used?: string }; headroom?: { h1?: string; d1?: string } }) {
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
