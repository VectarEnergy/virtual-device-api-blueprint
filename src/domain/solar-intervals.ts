const INTERVAL_MS = 15 * 60 * 1000;

/**
 * Last fully completed 15-minute UTC window as epoch seconds [start, end].
 * @param nowMs — for tests; defaults to `Date.now()`.
 */
export function getLastCompleted15MinRangeUtcSeconds(
  nowMs: number = Date.now(),
): { start: number; end: number } {
  const topOfCurrentInterval = Math.floor(nowMs / INTERVAL_MS) * INTERVAL_MS;
  const startMs = topOfCurrentInterval - INTERVAL_MS;
  const endMs = topOfCurrentInterval - 1;
  return {
    start: Math.floor(startMs / 1000),
    end: Math.floor(endMs / 1000),
  };
}
