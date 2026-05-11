import { describe, expect, it } from 'vitest';

import { historyOverlaps, parseSolarSeriesDelta } from '../../src/domain/solar-yield-math';

describe('parseSolarSeriesDelta', () => {
  it('returns delta from first to last odometer sample', () => {
    const series = [
      [0, 100],
      [1, 100],
      [2, 142.5],
    ];
    const r = parseSolarSeriesDelta(series as unknown[]);
    expect(r.total).toBeCloseTo(42.5);
    expect(r.absolute).toBeCloseTo(142.5);
  });

  it('treats dip as rollover guard (last < first → use last as delta)', () => {
    const series = [
      [0, 1000],
      [1, 50],
    ];
    const r = parseSolarSeriesDelta(series as unknown[]);
    expect(r.total).toBe(50);
  });

  it('empty or non-numeric series → 0', () => {
    expect(parseSolarSeriesDelta([]).total).toBe(0);
    expect(parseSolarSeriesDelta([[], []] as unknown[]).total).toBe(0);
  });
});

describe('historyOverlaps', () => {
  it('detects overlap on shared boundary', () => {
    const h = [{ start: 100, end: 200 }];
    expect(historyOverlaps(h, 200, 300)).toBe(true);
    expect(historyOverlaps(h, 201, 300)).toBe(false);
  });

  it('ignores rows with bad bounds', () => {
    expect(historyOverlaps([{ start: 'x', end: 1 }], 0, 10)).toBe(false);
  });
});
