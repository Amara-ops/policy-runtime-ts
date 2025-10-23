import { createHash } from 'node:crypto';

function stableStringify(obj: any): string {
  if (obj === null) return 'null';
  const t = typeof obj;
  if (t === 'number' || t === 'boolean' || t === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    // Align with JSON: undefined becomes null in arrays
    return '[' + obj.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',') + ']';
    }
  if (t !== 'object') return JSON.stringify(obj); // fallback (shouldn't happen)
  // Objects: drop undefined-valued keys to match JSON semantics
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export function computePolicyHash(policy: unknown): string {
  const s = stableStringify(policy);
  const h = createHash('sha256').update(s).digest('hex');
  return '0x' + h;
}
