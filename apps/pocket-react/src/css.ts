import type { CSSProperties } from "react";

/** Inline CSS custom properties: `vars({ s: 3 })` sets `--s: 3`. */
export const vars = (values: Record<string, string | number>): CSSProperties =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [`--${k}`, String(v)]));
