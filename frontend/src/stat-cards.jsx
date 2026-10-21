import React from 'react';
import Owl from './owl';

const weekNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ringLength = 2 * Math.PI * 35;

export function completionRate(completed = 0, scheduled = 0) {
  return scheduled > 0 ? Math.max(0, Math.min(100, Math.round(100 * completed / scheduled))) : 0;
}

function localDate(base, offset) {
  const date = new Date(`${base}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weekActivity(cells = [], today) {
  const byDate = new Map(cells.map(cell => [cell.date, cell]));
  const weekday = (new Date(`${today}T12:00:00`).getDay() + 6) % 7;
  return weekNames.map((label, index) => {
    const date = localDate(today, index - weekday);
    return { label, date, cell: date > today ? null : byDate.get(date) || null, future: date > today };
  });
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function FlameIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M25 44c-9 0-16-7-16-16 0-7 4-13 9-18 0 7 3 10 5 12 4-7 3-12 2-18 9 7 14 15 14 24 0 9-6 16-14 16Z" /><path d="M25 43c-4 0-7-3-7-7 0-4 3-7 6-11 0 4 2 5 3 6 2-2 2-4 2-6 3 4 5 8 5 11 0 4-4 7-9 7Z" /></svg>;
}

function Ring({ percentage }) {
  return <div className="stat-ring" aria-hidden="true"><svg viewBox="0 0 92 92"><circle className="stat-ring-track" cx="46" cy="46" r="35" /><circle key={percentage} className="stat-ring-fill" cx="46" cy="46" r="35" style={{ '--ring-length': ringLength, '--ring-offset': ringLength * (1 - percentage / 100) }} /></svg><span>{percentage}%</span><i><CheckIcon /></i></div>;
}

function StatCard({ type, label, value, detail, explanation, action, onClick, children }) {
  return <button type="button" className={`stat-card stat-card--${type}`} onClick={onClick} aria-label={`${label}: ${value}. ${detail}. ${action}`} aria-describedby={`stat-help-${type}`}>
    <span className="stat-card-head"><span className="stat-card-label">{label}</span><span className="stat-card-arrow" aria-hidden="true">↗</span></span>
    <span className="stat-card-content">{children}<span className="stat-card-copy"><strong>{value}</strong><small>{detail}</small></span></span>
    <span className="stat-card-footer">{action}<span aria-hidden="true">→</span></span>
    <span className="stat-card-tooltip" id={`stat-help-${type}`} role="tooltip">{explanation}</span>
  </button>;
}

export default function StatCards({ dashboard, activity, onAction }) {
  const today = activity?.cells?.at(-1)?.date;
  const todayDone = dashboard?.today?.completed || 0;
  const todayTotal = dashboard?.today?.total || 0;
  const weekDone = dashboard?.weekly_consistency?.completed || 0;
  const weekTotal = dashboard?.weekly_consistency?.scheduled || 0;
  const monthDone = dashboard?.monthly_completion?.completed || 0;
  const monthTotal = dashboard?.monthly_completion?.scheduled || 0;
  const todayRate = completionRate(todayDone, todayTotal);
  const weekRate = completionRate(weekDone, weekTotal);
  const monthRate = completionRate(monthDone, monthTotal);
  const streak = Math.max(0, dashboard?.overall_streak || 0);
  const days = today ? weekActivity(activity?.cells || [], today) : [];
  const byDate = new Map((activity?.cells || []).map(cell => [cell.date, cell]));
  const first = today ? new Date(`${today.slice(0, 7)}-01T12:00:00`) : null;
  const leading = first ? (first.getDay() + 6) % 7 : 0;
  const monthLength = first ? new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate() : 0;
  const monthCells = Array.from({ length: leading + monthLength }, (_, index) => {
    const day = index - leading + 1;
    if (day < 1) return null;
    const date = `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`;
    return { date, future: date > today, cell: byDate.get(date) };
  });

  return <section className="stat-card-grid" aria-label="Habit statistics">
    <StatCard type="today" label="Today's completion" value={`${todayRate}%`} detail={todayTotal ? `${todayDone} of ${todayTotal} scheduled` : 'No habits scheduled'} explanation="Completed scheduled habits today divided by habits scheduled today. A day with no scheduled habits shows zero percent." action="View today's tasks" onClick={() => onAction('today')}>
      <span className="stat-today-visual"><Ring percentage={todayRate} /><Owl className="stat-owl" /></span>
    </StatCard>
    <StatCard type="streak" label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} detail={`Best: ${dashboard?.overall_longest_streak || 0} ${(dashboard?.overall_longest_streak || 0) === 1 ? 'day' : 'days'}`} explanation="Consecutive successful scheduled days. Every habit scheduled on a day must be complete; days without scheduled habits are skipped. Best is the longest run of fully completed scheduled days." action="View streak details" onClick={() => onAction('streak')}>
      <span className="stat-streak-visual"><FlameIcon /><span className="stat-streak-days">{days.map(({ date, cell, future }) => <i key={date} className={future ? 'future' : !cell ? 'missing' : cell.streak_day ? 'complete' : cell.scheduled ? 'missed' : 'rest'} title={`${date}: ${future ? 'upcoming' : !cell ? 'activity unavailable' : cell.scheduled ? `${cell.completed}/${cell.scheduled} complete` : 'no habits scheduled'}`} />)}</span></span>
    </StatCard>
    <StatCard type="weekly" label="Weekly consistency" value={`${weekRate}%`} detail={weekTotal ? `${weekDone} of ${weekTotal} scheduled` : 'No habits scheduled'} explanation="Completed scheduled habit occurrences divided by all scheduled occurrences from Monday through today." action="View weekly trend" onClick={() => onAction('weekly')}>
      <span className="stat-week-bars" aria-hidden="true">{days.map(({ label, date, cell, future }) => <span key={date} title={`${date}: ${future ? 'upcoming' : !cell ? 'activity unavailable' : cell.scheduled ? `${cell.completed}/${cell.scheduled} complete` : 'no habits scheduled'}`}><i className={future ? 'future' : !cell ? 'missing' : cell.scheduled ? cell.completed ? 'active' : 'missed' : 'rest'} style={{ '--bar-height': cell?.scheduled ? `${completionRate(cell.completed, cell.scheduled)}%` : '0%' }} /><small>{label}</small></span>)}</span>
    </StatCard>
    <StatCard type="monthly" label="Monthly completion" value={`${monthRate}%`} detail={monthTotal ? `${monthDone} of ${monthTotal} scheduled` : 'No habits scheduled'} explanation="Completed scheduled habit occurrences divided by all scheduled occurrences from the first of this month through today." action="View monthly trend" onClick={() => onAction('monthly')}>
      <span className="stat-month-visual"><span className="stat-month-calendar" aria-hidden="true"><span className="stat-month-weekdays">{weekNames.map((name, index) => <small key={index}>{name}</small>)}</span><span className="stat-month-days">{monthCells.map((entry, index) => <i key={entry?.date || `pad-${index}`} className={!entry ? 'pad' : entry.future ? 'future' : !entry.cell ? 'missing' : !entry.cell.scheduled ? 'rest' : entry.cell.completed === entry.cell.scheduled ? 'complete' : entry.cell.completed ? 'partial' : 'missed'} title={entry ? `${entry.date}: ${entry.future ? 'upcoming' : !entry.cell ? 'activity unavailable' : `${entry.cell.completed}/${entry.cell.scheduled} complete`}` : undefined} />)}</span></span><Owl className="stat-owl" /></span>
    </StatCard>
  </section>;
}
