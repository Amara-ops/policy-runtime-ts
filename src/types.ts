export type Denomination = 'BASE_USDC';

export interface AllowEntry {
  chainId: number;
  to: string;      // lowercase 0x-address
  selector: string; // 0x + 4 bytes
}

export interface CapsConfig {
  max_outflow_h1?: string; // bigint as decimal string in base units
  max_outflow_d1?: string; // bigint as decimal string in base units
}

export interface PolicyMeta {
  schemaVersion?: string;
}

export interface Policy {
  allowlist: AllowEntry[];
  caps?: CapsConfig;
  pause?: boolean;
  meta?: PolicyMeta;
}

export interface Intent {
  chainId: number;
  to: string;         // lowercased 0x-address
  selector: string;   // 0x + 4 bytes
  token?: string;     // 0x-address of token (if applicable)
  amount?: string;    // bigint as decimal string in base units
  denomination?: Denomination;
}

export type DecisionAction = 'allow' | 'deny' | 'escalate';

export interface DecisionHeadroom {
  h1?: string; // remaining in base units
  d1?: string;
}

export interface Decision {
  action: DecisionAction;
  reasons: string[];
  headroom?: DecisionHeadroom;
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
