import { describe, expect, it } from 'vitest';
import { priorityHabits, priorityOf } from './priorities.js';

const habit = (id, priority, scheduled_today = false, done_today = false, active = true) => ({ id, priority, scheduled_today, done_today, active });

describe('priority dashboard filtering', () => {
  const habits = [
    habit(1, 'Low', true),
    habit(2, 'High', false),
    habit(3, 'Medium', true),
    habit(4, 'High', true, true),
    habit(5, 'High', true),
    habit(6, 'High', true, false, false),
  ];

  it('orders unfinished habits by priority and puts completed habits last', () => {
    expect(priorityHabits(habits, 'all').map(h => h.id)).toEqual([5, 2, 3, 1, 4]);
  });

  it('filters high priority, scheduled today and completed habits', () => {
    expect(priorityHabits(habits, 'high').map(h => h.id)).toEqual([5, 2, 4]);
    expect(priorityHabits(habits, 'due').map(h => h.id)).toEqual([5, 3, 1]);
    expect(priorityHabits(habits, 'completed').map(h => h.id)).toEqual([4]);
  });

  it('treats legacy records without a priority as Medium', () => {
    expect(priorityOf(habit(7, undefined))).toBe('Medium');
  });
});
