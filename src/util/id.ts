import { createHash } from 'node:crypto';
import type { Intent } from '../types.js';

export function policyHash(policy: unknown): string {
  const h = createHash('sha256');
  h.update(JSON.stringify(policy));
  return '0x' + h.digest('hex');
}

export function opId(policyHash: string, intent: Intent): string {
  const h = createHash('sha256');
  h.update(policyHash);
  h.update(JSON.stringify(intent));
  return '0x' + h.digest('hex');
}
