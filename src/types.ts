export type Denomination = 'BASE_USDC' | string; // v0.3: allow additional denominations via registry

export interface AllowEntry {
  chainId: number;
  to: string;      // lowercase 0x-address (contract target)
  selector: string; // 0x + 4 bytes
}

export type CapAmount = string | Record<string, string>; // string = global; record = per-denomination

export interface CapsConfig {
  max_outflow_h1?: CapAmount; // bigint as decimal string in base units (per denomination)
  max_outflow_d1?: CapAmount; // bigint as decimal string in base units (per denomination)
  // Aliases: accept new names while keeping old fields for compatibility
  max_per_function_h1?: number; // DEPRECATED alias of max_calls_per_function_h1
  max_calls_per_function_h1?: number; // preferred: count cap per selector per hour
  max_calls_per_function_d1?: number; // new: count cap per selector per day
  // v0.3 additions (optional, backward-compatible)
  per_target?: {
    h1?: Record<string, CapAmount>; // key = to or to|selector, value CapAmount (string or per-denom map)
    d1?: Record<string, CapAmount>;
  };
}

export interface PolicyMeta {
  schemaVersion?: string;
  // v0.3: denomination registry (symbol -> decimals); default BASE_USDC:6
  denominations?: Record<string, { decimals: number; chainId?: number; address?: string }>; 
  defaultDenomination?: string; // default if intent omits denomination
  // v0.3: optional nonce gap guard (EOA-style sequential nonces)
  nonce_max_gap?: number; // allow replacements (same nonce), deny regressions and jumps > gap
  // v0.3: optional max slippage in basis points
  slippage_max_bps?: number; // deny if intent.slippage_bps > slippage_max_bps
}

export interface Policy {
  allowlist: AllowEntry[];
  caps?: CapsConfig;
  pause?: boolean;
  meta?: PolicyMeta;
}

export interface Intent {
  chainId: number;
  to: string;         // lowercased 0x-address (contract target)
  selector: string;   // 0x + 4 bytes
  token?: string;     // 0x-address of token (if applicable)
  amount?: string;    // base units as a decimal string of digits only
  amount_human?: string; // optional human-readable decimal string; requires denomination and decimals in policy.meta
  denomination?: Denomination;
  // v0.3 filters (optional)
  deadline_ms?: number; // epoch ms; deny with DEADLINE_EXPIRED if now > deadline
  nonce?: number;       // current tx nonce proposed by the executor
  prev_nonce?: number;  // last submitted nonce observed by the executor
  slippage_bps?: number; // slippage or maxDeviation provided by caller, basis points
}

export type DecisionAction = 'allow' | 'deny' | 'escalate';

export interface DecisionHeadroom {
  h1?: string; // remaining in base units (may be negative if exceeded)
  d1?: string;
  per_fn_h1?: number; // remaining count
  per_fn_d1?: number; // remaining count (daily)
}

export interface DecisionTargetHeadroomDetail { key: string; remaining: string; }
export interface DecisionTargetHeadroom { h1?: DecisionTargetHeadroomDetail; d1?: DecisionTargetHeadroomDetail }

export interface Decision {
  action: DecisionAction;
  reasons: string[];
  headroom?: DecisionHeadroom;
  target_headroom?: DecisionTargetHeadroom;
}

export interface CounterWindow {
  used: bigint;
  windowStart: number; // epoch ms bucket start
}

export interface CounterStore {
  getWindow(key: string, windowMs: number, now: number): Promise<CounterWindow>;
  add(key: string, amount: bigint, windowMs: number, now: number): Promise<void>;
  load(): Promise<void>;
  persist(): Promise<void>;
}

export interface JsonlLogger {
  append(entry: Record<string, unknown>): Promise<void>;
}
