export function toBigIntDecimal(s?: string): bigint {
  if (!s) return 0n;
  if (!/^\d+$/.test(s)) throw new Error('amount must be a decimal string of base units');
  return BigInt(s);
}

export function humanToBaseUnits(amountHuman: string, decimals: number): bigint {
  // Reject scientific notation or commas; allow up to `decimals` fraction digits.
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amountHuman)) throw new Error('amount_human must be a simple decimal string');
  const [intPart, fracRaw = ''] = amountHuman.split('.');
  if (fracRaw.length > decimals) throw new Error('HUMAN_PRECISION_EXCEEDED');
  const frac = fracRaw.padEnd(decimals, '0');
  const s = (intPart === '' ? '0' : intPart) + (decimals ? frac : '');
  // strip leading zeros
  const normalized = s.replace(/^0+/, '') || '0';
  return BigInt(normalized);
}

export function clampNonNegative(x: bigint): bigint {
  return x < 0n ? 0n : x;
}
