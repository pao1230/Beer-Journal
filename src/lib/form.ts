export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`"${key}" must be a number`);
  return n;
}

export function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n == null ? null : Math.round(n);
}

export function required<T>(value: T | null, name: string): T {
  if (value == null) throw new Error(`${name} is required`);
  return value;
}

export type ActionState = { error?: string; ok?: boolean };
