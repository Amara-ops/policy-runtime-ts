export type Denomination = string; // symbol-only keys (e.g., USDC, ETH)

export interface AllowEntry {
  chainId: number;
  to: string;      // lowercase 0x-address (contract target)
  selector: string; // 0x + 4 bytes
}

// CapAmount: per-denomination map of human decimal strings or base-unit strings
export type CapAmount = Record<string, string>;

export interface CapsConfig {
  max_outflow_h1?: CapAmount; // per-symbol map of human strings (converted at evaluation)
  max_outflow_d1?: CapAmount;
  // Function call count caps
  max_per_function_h1?: number; // DEPRECATED alias of max_calls_per_function_h1
  max_calls_per_function_h1?: number;
  max_calls_per_function_d1?: number;
  per_target?: {
    h1?: Record<string, CapAmount>; // key = to or to|selector; value = per-symbol human strings
    d1?: Record<string, CapAmount>;
  };
}

export interface PolicyMeta {
  schemaVersion?: string;
  // tokens registry path (preferred), or env TOKENS_CONFIG_PATH
  tokens_registry_path?: string;
  // Optional legacy fallback
  denominations?: Record<string, { decimals: number; chainId?: number; address?: string }>;
  defaultDenomination?: string;
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
