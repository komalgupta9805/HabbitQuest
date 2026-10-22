export function normalizeHabitSelection(selectedIds, activeIds) {
  const active = new Set(activeIds);
  const valid = [...new Set(selectedIds)].filter(id => active.has(id));
  return valid.length ? [valid[0]] : activeIds.slice(0, 1);
}

export function selectHabit(id) {
  return id == null ? [] : [Number(id)];
}
