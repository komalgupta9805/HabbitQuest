import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StatCards, { completionRate, weekActivity } from './stat-cards';

describe('stat card data', () => {
  it('uses scheduled occurrences as the denominator and handles rest days', () => {
    expect(completionRate(1, 3)).toBe(33);
    expect(completionRate(0, 0)).toBe(0);
    expect(completionRate(4, 3)).toBe(100);
  });

  it('aligns real daily activity with Monday through Sunday without filling future dates', () => {
    const monday = { date: '2026-10-19', completed: 1, scheduled: 2 };
    const wednesday = { date: '2026-10-21', completed: 2, scheduled: 2 };
    const days = weekActivity([monday, wednesday], '2026-10-21');
    expect(days.map(day => day.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(days[0].cell).toBe(monday);
    expect(days[1].cell).toBeNull();
    expect(days[2].cell).toBe(wednesday);
    expect(days[3].future).toBe(true);
    expect(days[3].cell).toBeNull();
  });

  it('renders backend totals and marks missing activity as unavailable', () => {
    const dashboard = {
      today: { completed: 1, total: 2 },
      overall_streak: 3,
      overall_longest_streak: 5,
      weekly_consistency: { completed: 2, scheduled: 4 },
      monthly_completion: { completed: 3, scheduled: 6 },
    };
    const activity = { cells: [
      { date: '2026-10-19', completed: 1, scheduled: 2 },
      { date: '2026-10-21', completed: 1, scheduled: 2 },
    ] };
    const html = renderToStaticMarkup(React.createElement(StatCards, { dashboard, activity, onAction: () => {} }));
    expect(html).toContain('Today&#x27;s completion: 50%');
    expect(html).toContain('Current streak: 3 days');
    expect(html).toContain('Best: 5 days');
    expect(html).toContain('Weekly consistency: 50%');
    expect(html).toContain('Monthly completion: 50%');
    expect(html).toContain('2026-10-20: activity unavailable');
    expect(html).toContain('class="missing"');
  });
});
