import fs from 'node:fs';

export type TokenEntry = {
  symbol: string;
  chain_id?: number;
  decimals: number;
  address?: string | null;
  native?: boolean;
};

export type Registry = Map<string, number>; // symbol (uppercased) -> decimals

export function loadRegistry(explicitPath?: string): Registry {
  const path = explicitPath || process.env.TOKENS_CONFIG_PATH || 'config/tokens.json';
  try {
    const raw = fs.readFileSync(path, 'utf-8');
    const arr = JSON.parse(raw) as TokenEntry[];
    const m = new Map<string, number>();
    for (const t of arr) {
      if (!t || typeof t.symbol !== 'string') continue;
      const sym = t.symbol.trim().toUpperCase();
      if (!sym) continue;
      if (typeof t.decimals === 'number' && Number.isInteger(t.decimals) && t.decimals >= 0) {
        // prefer first-seen; symbols should have consistent decimals across chains
        if (!m.has(sym)) m.set(sym, t.decimals);
      }
    }
    return m;
  } catch {
    return new Map<string, number>();
  }
}

export function decimalsForSymbol(sym: string | undefined, reg: Registry): number | undefined {
  if (!sym) return undefined;
  const s = sym.toUpperCase();
  return reg.get(s);
}
