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
          // Top-level string remains base-units only (legacy). Human strings allowed only in per-denomination maps.
          max_outflow_h1: { anyOf: [ baseUnits, { type: 'object', additionalProperties: perDenomMap } ] },
          max_outflow_d1: { anyOf: [ baseUnits, { type: 'object', additionalProperties: perDenomMap } ] },
          max_per_function_h1: { type: 'integer', minimum: 1 },
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

// v0.3.3: normalize human caps to base units using meta.denominations
export function normalizeAndValidatePolicy(policy: unknown): Policy {
  const p = validatePolicy(policy);
  const reg = p.meta?.denominations || {};

  function decimalsFor(denom: string): number {
    const d = reg[denom];
    if (!d || typeof d.decimals !== 'number') throw new Error(`denominations missing decimals for ${denom}`);
    return d.decimals;
  }
  function toBaseStringHumanAware(v: string, denom: string): string {
    if (/^\d+$/.test(v)) return v; // already base units
    if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`invalid cap amount for ${denom}`);
    return humanToBaseUnits(v, decimalsFor(denom)).toString();
  }
  function normalizeCapAmount(cap: any): any {
    if (cap === undefined || cap === null) return cap;
    if (typeof cap === 'string') return cap; // legacy base-units string stays as-is
    // cap is object: keys -> denom or target; values -> string or per-denom map
    const out: Record<string, any> = {};
    for (const k of Object.keys(cap)) {
      const v = cap[k];
      if (typeof v === 'string') {
        // This branch occurs for per_target maps; here k is a target key, and v is a global base-units string; keep as-is
        out[k] = v;
      } else if (v && typeof v === 'object') {
        // per-denomination map under key k
        const sub = v as Record<string, any>;
        const flat: Record<string, string> = {};
        for (const denom of Object.keys(sub)) {
          const vv = sub[denom];
          if (typeof vv === 'string') {
            flat[denom] = toBaseStringHumanAware(vv, denom);
          } else if (vv && typeof vv === 'object') {
            // nested again; try vv[denom]
            const leaf = vv[denom];
            if (typeof leaf !== 'string') throw new Error(`invalid nested cap for ${denom}`);
            flat[denom] = toBaseStringHumanAware(leaf, denom);
          } else {
            throw new Error(`invalid cap value for ${denom}`);
          }
        }
        out[k] = flat;
      } else {
        throw new Error('invalid cap structure');
      }
    }
    return out;
  }

  if (p.caps) {
    if (p.caps.max_outflow_h1 && typeof p.caps.max_outflow_h1 === 'object') p.caps.max_outflow_h1 = normalizeCapAmount(p.caps.max_outflow_h1);
    if (p.caps.max_outflow_d1 && typeof p.caps.max_outflow_d1 === 'object') p.caps.max_outflow_d1 = normalizeCapAmount(p.caps.max_outflow_d1);
    if (p.caps.per_target) {
      if (p.caps.per_target.h1) p.caps.per_target.h1 = normalizeCapAmount(p.caps.per_target.h1);
      if (p.caps.per_target.d1) p.caps.per_target.d1 = normalizeCapAmount(p.caps.per_target.d1);
    }
  }
  return p;
}
