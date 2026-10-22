import { describe, expect, it } from 'vitest';
import { normalizeHabitSelection, toggleHabitSelection } from './habit-selection';

describe('habit heatmap selection', () => {
  it('defaults to the first four active habits without deleting other IDs', () => {
    expect(normalizeHabitSelection([], [1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4]);
  });

  it('removes archived IDs and preserves the chosen active order', () => {
    expect(normalizeHabitSelection([8, 3, 4], [2, 3, 4, 5])).toEqual([3, 4]);
  });

  it('enforces four visible histories while allowing a user to swap selections', () => {
    const full = [1, 2, 3, 4];
    expect(toggleHabitSelection(full, 5)).toEqual(full);
    expect(toggleHabitSelection(toggleHabitSelection(full, 2), 5)).toEqual([1, 3, 4, 5]);
  });
});
