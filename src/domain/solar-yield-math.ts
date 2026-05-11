/**
 * Pure helpers for Victron `total_solar_yield` (odometer) series and history windows.
 */

export function parseSolarSeriesDelta(series: unknown[]): {
  total: number;
  absolute?: number;
} {
  if (!Array.isArray(series) || series.length === 0) return { total: 0 };

  const values: number[] = series
    .map((v) => Number(Array.isArray(v) ? v[v.length - 1] : v))
    .filter((n) => Number.isFinite(n));

  if (values.length === 0) return { total: 0 };

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last >= first ? last - first : last;
  return { total: delta, absolute: last };
}

/** True if any history row's [start,end] overlaps [a,b] (inclusive), epoch seconds. */
export function historyOverlaps(
  history: Array<{ start?: unknown; end?: unknown }>,
  a: number,
  b: number,
): boolean {
  return history.some((h) => {
    const hs = Number(h?.start);
    const he = Number(h?.end);
    if (!Number.isFinite(hs) || !Number.isFinite(he)) return false;
    return hs <= b && he >= a;
  });
}
