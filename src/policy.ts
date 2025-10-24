import Ajv2020 from 'ajv/dist/2020.js';
import type { AllowEntry, Policy } from './types.js';
import { humanToBaseUnits } from './util/amount.js';

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
  const decimalOrHuman = { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' } as const;
  const baseUnits = { type: 'string', pattern: '^[0-9]+$' } as const;
  const perDenomMap = { anyOf: [ baseUnits, { type: 'object', additionalProperties: decimalOrHuman } ] } as const;
  const nestedPerDenomMap = { type: 'object', additionalProperties: decimalOrHuman } as const;

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
        additionalProperties: true,
        properties: {
          max_outflow_h1: { anyOf: [ baseUnits, { type: 'object', additionalProperties: perDenomMap } ] },
          max_outflow_d1: { anyOf: [ baseUnits, { type: 'object', additionalProperties: perDenomMap } ] },
          // Accept both old and new keys
          max_per_function_h1: { type: 'integer', minimum: 1 },
          max_calls_per_function_h1: { type: 'integer', minimum: 1 },
          max_calls_per_function_d1: { type: 'integer', minimum: 1 },
          per_target: {
            type: 'object',
            additionalProperties: false,
            properties: {
              h1: { type: 'object', additionalProperties: { anyOf: [ baseUnits, perDenomMap, nestedPerDenomMap ] } },
              d1: { type: 'object', additionalProperties: { anyOf: [ baseUnits, perDenomMap, nestedPerDenomMap ] } }
            }
          }
        }
      },
      pause: { type: 'boolean' },
      meta: {
        type: 'object',
        additionalProperties: true,
        properties: {
          schemaVersion: { type: 'string' },
          tokens_registry_path: { type: 'string' },
          denominations: { type: 'object', additionalProperties: { type: 'object', properties: { decimals: { type: 'integer', minimum: 0 }, chainId: { type: 'integer', minimum: 1 }, address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' } }, required: ['decimals'] } },
          defaultDenomination: { type: 'string' }
        }
      }
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

// v0.3.5: normalize human caps to base units using registry symbols (preferred) or legacy meta.denominations
export function normalizeAndValidatePolicy(policy: unknown): Policy {
  const p = validatePolicy(policy);

  const registryPath = p.meta?.tokens_registry_path;
  const registry = undefined; // normalization uses symbol decimals per entry; actual decimals are resolved in engine via util/denom.ts

  function toBaseStringHumanAware(v: string, symbol: string): string {
    if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`invalid cap amount for ${symbol}`);
    // We cannot reliably know decimals at this point without I/O; keep human as-is and let engine resolve when enforcing per symbol.
    // However, to preserve previous behavior, we will convert using legacy meta.denominations if provided.
    const legacy = p.meta?.denominations?.[symbol];
    if (legacy && typeof legacy.decimals === 'number') {
      return humanToBaseUnits(v, legacy.decimals).toString();
    }
    // If no legacy decimals, store the human string under the symbol; engine will resolve at evaluation.
    return v;
  }

  function normalizeCapAmount(cap: any): any {
    if (cap === undefined || cap === null) return cap;
    if (typeof cap === 'string') return cap; // base-units string stays as-is
    const out: Record<string, any> = {};
    for (const k of Object.keys(cap)) {
      const v = cap[k];
      if (typeof v === 'string') {
        out[k] = toBaseStringHumanAware(v, k);
      } else if (v && typeof v === 'object') {
        const sub = v as Record<string, any>;
        const flat: Record<string, string> = {};
        for (const sym of Object.keys(sub)) {
          const vv = sub[sym];
          if (typeof vv !== 'string') throw new Error(`invalid nested cap for ${sym}`);
          flat[sym] = toBaseStringHumanAware(vv, sym);
        }
        out[k] = flat;
      } else {
        throw new Error(`invalid cap value for ${k}`);
      }
    }
    return out;
  }

  if (p.caps) {
    if (p.caps.max_outflow_h1 && typeof p.caps.max_outflow_h1 === 'object') p.caps.max_outflow_h1 = normalizeCapAmount(p.caps.max_outflow_h1);
    if (p.caps.max_outflow_d1 && typeof p.caps.max_outflow_d1 === 'object') p.caps.max_outflow_d1 = normalizeCapAmount(p.caps.max_outflow_d1);

    const calls_h1 = (p.caps as any).max_calls_per_function_h1 ?? p.caps.max_per_function_h1;
    const calls_d1 = (p.caps as any).max_calls_per_function_d1;
    (p.caps as any).max_calls_per_function_h1 = calls_h1;
    (p.caps as any).max_calls_per_function_d1 = calls_d1;

    if (p.caps.per_target) {
      if (p.caps.per_target.h1) p.caps.per_target.h1 = normalizeCapAmount(p.caps.per_target.h1);
      if (p.caps.per_target.d1) p.caps.per_target.d1 = normalizeCapAmount(p.caps.per_target.d1);
    }
  }
  return p;
}
