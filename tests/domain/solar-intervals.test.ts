import { describe, expect, it } from 'vitest';

import { getLastCompleted15MinRangeUtcSeconds } from '../../src/domain/solar-intervals';

describe('getLastCompleted15MinRangeUtcSeconds', () => {
  it('at 14:35:00.000Z → previous slot 14:15–14:29:59', () => {
    const now = Date.parse('2026-05-11T14:35:00.000Z');
    const { start, end } = getLastCompleted15MinRangeUtcSeconds(now);
    expect(new Date(start * 1000).toISOString()).toBe('2026-05-11T14:15:00.000Z');
    expect(new Date(end * 1000).toISOString()).toBe('2026-05-11T14:29:59.000Z');
  });

  it('at exact 15m boundary uses prior full slot', () => {
    const now = Date.parse('2026-05-11T14:30:00.000Z');
    const { start, end } = getLastCompleted15MinRangeUtcSeconds(now);
    expect(new Date(start * 1000).toISOString()).toBe('2026-05-11T14:15:00.000Z');
    expect(end - start + 1).toBe(15 * 60);
  });
});
