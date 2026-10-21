export function padActivityCells(cells) {
  if (!cells.length) return [];
  const leadingWeekdays = new Date(`${cells[0].date}T12:00:00`).getDay();
  return [...Array.from({ length: leadingWeekdays }, () => null), ...cells];
}

export function monthColumns(cells) {
  if (!cells.length) return [];
  const leadingWeekdays = new Date(`${cells[0].date}T12:00:00`).getDay();
  const seen = new Set();
  return cells.flatMap((cell, index) => {
    const month = cell.date.slice(0, 7);
    if (seen.has(month)) return [];
    seen.add(month);
    return [{ key: month, label: new Date(`${cell.date}T12:00:00`).toLocaleString('en', { month: 'short' }), column: Math.floor((index + leadingWeekdays) / 7) + 1 }];
  });
}
