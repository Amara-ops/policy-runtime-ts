export interface DenominationInfo { decimals: number; chainId?: number; address?: string }

export function getDenominationInfo(symbol: string | undefined, registry?: Record<string, DenominationInfo>): DenominationInfo {
  const sym = symbol ?? 'BASE_USDC';
  const fromReg = registry?.[sym];
  if (fromReg) return fromReg;
  // Defaults
  if (sym === 'BASE_USDC') return { decimals: 6, chainId: 8453, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' };
  // Fallback if unknown: assume 18 decimals
  return { decimals: 18 };
}
