import Ajv2020 from 'ajv/dist/2020.js';
import type { AllowEntry, Policy } from './types.js';

export function normalizeAddress(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('invalid address');
  return addr.toLowerCase();
}

export function normalizeSelector(sel: string): string {
  if (!/^0x[0-9a-fA-F]{8}$/.test(sel)) throw new Error('invalid selector');
  return sel.toLowerCase();
}

export function inAllowlist(allow: AllowEntry[], chainId: number, to: string, selector: string): boolean {
  const toLc = normalizeAddress(to);
  const selLc = normalizeSelector(selector);
  return allow.some(e => e.chainId === chainId && e.to === toLc && e.selector === selLc);
}

export function validatePolicy(policy: unknown): Policy {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const schema = {
    type: 'object',
    required: ['allowlist'],
    additionalProperties: true,
    properties: {
      allowlist: {
        type: 'array',
        items: {
          type: 'object',
          required: ['chainId', 'to', 'selector'],
          properties: {
            chainId: { type: 'integer', minimum: 1 },
            to: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
            selector: { type: 'string', pattern: '^0x[0-9a-fA-F]{8}$' }
          },
          additionalProperties: false
        }
      },
      caps: {
        type: 'object',
        additionalProperties: false,
        properties: {
          max_outflow_h1: { type: 'string', pattern: '^[0-9]+$' },
          max_outflow_d1: { type: 'string', pattern: '^[0-9]+$' },
          max_per_function_h1: { type: 'integer', minimum: 1 }
        }
      },
      pause: { type: 'boolean' },
      meta: { type: 'object' }
    }
  } as const;
  const validate = ajv.compile(schema);
  if (!validate(policy)) {
    const msg = (validate.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('; ');
    throw new Error('policy schema invalid: ' + msg);
  }
  const p = policy as Policy;
  // normalize allowlist entries
  p.allowlist = p.allowlist.map(e => ({ chainId: e.chainId, to: normalizeAddress(e.to), selector: normalizeSelector(e.selector) }));
  return p;
}
