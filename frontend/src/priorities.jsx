import React, { useState } from 'react';
import { PRIORITIES, priorityHabits, priorityOf } from './priorities';

export function PriorityControl({ habit, onChange, saving }) {
  return <label className="priority-control">Priority
    <select aria-label={`Priority for ${habit.name}`} value={priorityOf(habit)} disabled={saving} onChange={event => onChange(habit, event.target.value)}>
      {PRIORITIES.map(level => <option key={level} value={level}>{level}</option>)}
    </select>
  </label>;
}

export function PriorityQuest({ habits, onPriorityChange, savingId, feedback, onOpenHabits }) {
  const [filter, setFilter] = useState('all');
  const rows = priorityHabits(habits, filter);
  const remaining = habits.filter(habit => habit.active && habit.scheduled_today && !habit.done_today).length;
  return <section className="priority-quest panel" aria-labelledby="priority-quest-title">
    <div className="priority-quest-head"><div><p className="eyebrow">YOUR FOCUS</p><h2 id="priority-quest-title">Today's Priorities</h2><p>{remaining ? `${remaining} scheduled ${remaining === 1 ? 'habit' : 'habits'} still to do today.` : 'Your scheduled habits are all caught up today.'}</p></div><button className="priority-library-link" onClick={onOpenHabits}>View all habits <span aria-hidden="true">→</span></button></div>
    <div className="priority-filters" role="group" aria-label="Filter priorities">{[['all','All'],['high','High Priority'],['due','Due Today'],['completed','Completed']].map(([value,label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <p className="priority-note">Due Today means scheduled for your local day. Recurring habits have no overdue deadline.</p>
    {feedback?.text && <p className={feedback.type === 'error' ? 'priority-feedback error' : 'priority-feedback'} role="status">{feedback.text}</p>}
    {rows.length ? <div className="priority-grid">{rows.map(habit => <article className={`priority-item priority-${priorityOf(habit).toLowerCase()} ${habit.done_today ? 'is-done' : ''}`} key={habit.id}>
      <span className="priority-item-icon" style={{ '--habit-color': habit.color }} aria-hidden="true">{habit.done_today ? '✓' : '◇'}</span>
      <div className="priority-item-main"><div className="priority-item-title"><h3>{habit.name}</h3><span className="priority-badge">{priorityOf(habit)} priority</span></div><p><span className="priority-category-dot" style={{ backgroundColor: habit.color }} />{habit.category || 'Personal'} <span aria-hidden="true">·</span> {habit.done_today ? 'Completed today' : habit.scheduled_today ? 'Scheduled today' : 'Next scheduled day'}</p></div>
      <PriorityControl habit={habit} onChange={onPriorityChange} saving={savingId !== null} />
    </article>)}</div> : <div className="priority-empty">{filter === 'completed' ? 'No habits completed today yet.' : filter === 'due' ? 'Nothing is scheduled and incomplete today.' : filter === 'high' ? 'No high priority habits yet.' : 'Add a habit to start your priority quest.'}</div>}
  </section>;
}
