import { describe, expect, it } from 'vitest';
import { monthColumns, padActivityCells } from './date-utils';

describe('activity calendar alignment', () => {
  it('pads the first week to the correct weekday row', () => {
    const cells = [{ date: '2026-10-21', completed: 1 }];
    const padded = padActivityCells(cells);
    expect(padded.slice(0, 3)).toEqual([null, null, null]);
    expect(padded[3]).toBe(cells[0]);
  });

  it('places month labels at the first chronological week column', () => {
    const cells = [{ date: '2026-10-30' }, { date: '2026-10-31' }, { date: '2026-11-01' }];
    expect(monthColumns(cells).map(x => [x.key, x.column])).toEqual([['2026-10', 1], ['2026-11', 2]]);
  });
});
