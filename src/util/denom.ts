import { loadRegistry, decimalsForSymbol, type Registry } from './registry.js';

export interface DenominationInfo { decimals: number; chainId?: number; address?: string }

// Resolve decimals by symbol using the registry. Keep a fallback for legacy BASE_USDC.
export function getDenominationInfo(symbol: string | undefined, legacyRegistry?: Record<string, DenominationInfo>, explicitRegistryPath?: string): DenominationInfo {
  const sym = (symbol || '').toUpperCase();
  // 1) Preferred: tokens registry JSON
  const reg: Registry = loadRegistry(explicitRegistryPath);
  const dec = decimalsForSymbol(sym, reg);
  if (typeof dec === 'number') return { decimals: dec };

  // 2) Legacy policy.meta.denominations fallback
  if (sym && legacyRegistry && legacyRegistry[sym]) return legacyRegistry[sym];

  // 3) Legacy hardcoded BASE_USDC
  if (sym === 'BASE_USDC') return { decimals: 6, chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' };

  // 4) Final fallback: 18 decimals
  return { decimals: 18 };
}
