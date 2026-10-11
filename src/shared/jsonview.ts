// Helpers for rendering arbitrary bwoc JSON as a table / tree.

export type Scalar = string | number | boolean | null;
export const isScalar = (v: unknown): v is Scalar =>
  v === null || ["string", "number", "boolean"].includes(typeof v);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Cell text: scalars verbatim, nested values as compact JSON. */
export function cellText(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "null";
  return typeof v === "string" ? v : isScalar(v) ? String(v) : JSON.stringify(v);
}

/** A non-empty array of plain objects can be shown as a table; otherwise null. */
export function toTable(v: unknown): { columns: string[]; rows: Record<string, unknown>[] } | null {
  if (!Array.isArray(v) || v.length === 0 || !v.every(isRecord)) return null;
  const columns: string[] = [];
  for (const row of v) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k);
  return { columns, rows: v };
}
