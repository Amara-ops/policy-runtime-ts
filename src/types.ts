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
  max_per_function_h1?: number; // optional count cap per selector per hour
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
  amount?: string;    // bigint as decimal string in base units
  denomination?: Denomination;
}

export type DecisionAction = 'allow' | 'deny' | 'escalate';

export interface DecisionHeadroom {
  h1?: string; // remaining in base units (may be negative if exceeded)
  d1?: string;
  per_fn_h1?: number; // remaining count
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
