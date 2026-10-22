import { describe, expect, it } from 'vitest';
import { normalizeHabitSelection, selectHabit } from './habit-selection';

describe('habit heatmap selection', () => {
  it('defaults to the first active habit without deleting any saved history', () => {
    expect(normalizeHabitSelection([], [1, 2, 3, 4, 5, 6])).toEqual([1]);
  });

  it('removes archived IDs and preserves the chosen active order', () => {
    expect(normalizeHabitSelection([8, 3, 4], [2, 3, 4, 5])).toEqual([3]);
  });

  it('stores exactly the habit chosen in the dropdown', () => {
    expect(selectHabit(5)).toEqual([5]);
    expect(selectHabit('8')).toEqual([8]);
  });
});
