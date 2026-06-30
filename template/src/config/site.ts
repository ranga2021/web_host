import type { SiteConfig } from './types';
import { defaults } from './defaults';

declare global {
  interface Window {
    __SITE__?: Partial<SiteConfig>;
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function deepMerge<T>(base: T, over: any): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(over)) return over as T;
  if (isObj(base) && isObj(over)) {
    const out: any = { ...base };
    for (const k of Object.keys(over)) {
      out[k] = deepMerge((base as any)[k], over[k]);
    }
    return out;
  }
  return over as T;
}

const override =
  typeof window !== 'undefined' && (window as any).__SITE__
    ? (window as any).__SITE__
    : undefined;

export const site: SiteConfig = deepMerge(defaults, override);
