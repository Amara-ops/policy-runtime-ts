export type Denomination = string; // v0.3.5: symbol-only keys (e.g., USDC)

export interface AllowEntry {
  chainId: number;
  to: string;      // lowercase 0x-address (contract target)
  selector: string; // 0x + 4 bytes
}

export type CapAmount = string | Record<string, string>; // string = global; record = per-denomination (by symbol)

export interface CapsConfig {
  max_outflow_h1?: CapAmount; // bigint base units, or per-symbol map of human strings (normalized at load)
  max_outflow_d1?: CapAmount;
  // Aliases: accept new names while keeping old fields for compatibility
  max_per_function_h1?: number; // DEPRECATED alias of max_calls_per_function_h1
  max_calls_per_function_h1?: number;
  max_calls_per_function_d1?: number;
  per_target?: {
    h1?: Record<string, CapAmount>; // key = to or to|selector; value string (base) or per-symbol human map
    d1?: Record<string, CapAmount>;
  };
}

export interface PolicyMeta {
  schemaVersion?: string;
  // v0.3.5: tokens registry path (preferred), or env TOKENS_CONFIG_PATH
  tokens_registry_path?: string;
  // Deprecated fields (kept for back-compat; linter warns)
  denominations?: Record<string, { decimals: number; chainId?: number; address?: string }>;
  defaultDenomination?: string; // no longer needed; intents should specify symbol; fallback used if present
  nonce_max_gap?: number;
  slippage_max_bps?: number;
}

export interface Policy {
  allowlist: AllowEntry[];
  caps?: CapsConfig;
  pause?: boolean;
  meta?: PolicyMeta;
}

export interface Intent {
  chainId: number;
  to: string;
  selector: string;
  token?: string;
  amount?: string;    // base units
  amount_human?: string; // human units
  denomination?: Denomination; // symbol (e.g., USDC)
  deadline_ms?: number;
  nonce?: number;
  prev_nonce?: number;
  slippage_bps?: number;
}

export type DecisionAction = 'allow' | 'deny' | 'escalate';

export interface DecisionHeadroom {
  h1?: string;
  d1?: string;
  per_fn_h1?: number;
  per_fn_d1?: number;
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
  windowStart: number;
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
