import { createHash } from 'node:crypto';

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map((v) => stableStringify(v)).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export function computePolicyHash(policy: unknown): string {
  const s = stableStringify(policy);
  const h = createHash('sha256').update(s).digest('hex');
  return '0x' + h;
}
