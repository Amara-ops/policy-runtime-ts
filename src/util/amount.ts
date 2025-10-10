export function toBigIntDecimal(s?: string): bigint {
  if (!s) return 0n;
  if (!/^\d+$/.test(s)) throw new Error('amount must be a decimal string of base units');
  return BigInt(s);
}

export function clampNonNegative(x: bigint): bigint {
  return x < 0n ? 0n : x;
}
