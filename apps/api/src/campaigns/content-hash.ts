import { sha256 } from '../common/crypto.ts';

/** JSON canónico (claves ordenadas): el mismo contenido produce siempre el mismo hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const contentHash = (content: unknown): string => sha256(canonicalJson(content));
