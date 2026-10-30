// Minimal, dependency-free input validation shared by server and client.

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

export function str(value: unknown, field: string, opts: { min?: number; max: number; optional?: boolean }): string | null {
  if (value === undefined || value === null || value === '') {
    if (opts.optional) return null;
    throw new ValidationError(field, 'is required');
  }
  if (typeof value !== 'string') throw new ValidationError(field, 'must be a string');
  const v = value.replace(/\u0000/g, '').trim();
  if (!v && opts.optional) return null;
  if (v.length < (opts.min ?? 1)) throw new ValidationError(field, `must have at least ${opts.min ?? 1} characters`);
  if (v.length > opts.max) throw new ValidationError(field, `must have at most ${opts.max} characters`);
  return v;
}

export function reqStr(value: unknown, field: string, max: number, min = 1): string {
  return str(value, field, { max, min }) as string;
}

export function optStr(value: unknown, field: string, max: number): string | null {
  return str(value, field, { max, optional: true });
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(field, `must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function optOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | null {
  if (value === undefined || value === null || value === '') return null;
  return oneOf(value, field, allowed);
}

export function int(value: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): number | null {
  if (value === undefined || value === null || value === '') {
    if (opts.optional) return null;
    throw new ValidationError(field, 'is required');
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) throw new ValidationError(field, 'must be an integer');
  if (opts.min !== undefined && n < opts.min) throw new ValidationError(field, `must be >= ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new ValidationError(field, `must be <= ${opts.max}`);
  return n;
}

export function num(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(field, `must be a number between ${min} and ${max}`);
  return n;
}

export function url(value: unknown, field: string, optional = true): string | null {
  const v = str(value, field, { max: 2000, optional });
  if (v === null) return null;
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    throw new ValidationError(field, 'must be a valid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new ValidationError(field, 'must use http or https');
  return parsed.toString();
}

export function arr<T>(value: unknown, field: string, max: number, each: (v: unknown, i: number) => T): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(field, 'must be a list');
  if (value.length > max) throw new ValidationError(field, `must have at most ${max} entries`);
  return value.map(each);
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'entry';
}

export function isoDateOrYear(value: unknown, field: string): string | null {
  const v = optStr(value, field, 10);
  if (v === null) return null;
  if (!/^-?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(v)) throw new ValidationError(field, 'must be YYYY, YYYY-MM or YYYY-MM-DD');
  return v;
}
