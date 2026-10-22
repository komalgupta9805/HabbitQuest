export const PRIORITIES = ['High', 'Medium', 'Low'];

export function priorityOf(habit) {
  return PRIORITIES.includes(habit.priority) ? habit.priority : 'Medium';
}

export function priorityHabits(habits = [], filter = 'all') {
  const active = habits.filter(habit => habit.active);
  const filtered = active.filter(habit => {
    if (filter === 'high') return priorityOf(habit) === 'High';
    if (filter === 'due') return habit.scheduled_today && !habit.done_today;
    if (filter === 'completed') return habit.done_today;
    return true;
  });
  return filtered.sort((a, b) =>
    Number(a.done_today) - Number(b.done_today)
    || PRIORITIES.indexOf(priorityOf(a)) - PRIORITIES.indexOf(priorityOf(b))
    || Number(b.scheduled_today) - Number(a.scheduled_today)
    || a.id - b.id
  );
}
