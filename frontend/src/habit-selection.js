export const MAX_TRACKED_HABITS = 4;

export function normalizeHabitSelection(selectedIds, activeIds) {
  const active = new Set(activeIds);
  const valid = [...new Set(selectedIds)].filter(id => active.has(id)).slice(0, MAX_TRACKED_HABITS);
  return valid.length ? valid : activeIds.slice(0, MAX_TRACKED_HABITS);
}

export function toggleHabitSelection(selectedIds, id) {
  if (selectedIds.includes(id)) return selectedIds.filter(value => value !== id);
  if (selectedIds.length >= MAX_TRACKED_HABITS) return selectedIds;
  return [...selectedIds, id];
}
