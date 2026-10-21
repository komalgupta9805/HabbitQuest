import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './functional.css';
import './product.css';
import './redesign.css';
import './stat-cards.css';
import './reference.css';
import { monthColumns, padActivityCells } from './date-utils';
import { browserTimeZone } from './timezone';
import StatCards, { completionRate, weekActivity } from './stat-cards';
import Owl, { LeafLogo } from './owl';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const todayIso = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };

async function api(path, { token, method = 'GET', body } = {}) {
  const timeZone = browserTimeZone();
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(timeZone ? { 'X-Time-Zone': timeZone } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = Array.isArray(data.detail) ? data.detail.map(item => item.msg).join(' ') : data.detail;
    throw new Error(detail || 'The request could not be completed.');
  }
  return response.status === 204 ? null : response.json();
}

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ busy: false, message: '' });
  const submit = async (event) => {
    event.preventDefault();
    setStatus({ busy: true, message: '' });
    try {
      const result = await api(`/auth/${mode}`, { method: 'POST', body: form });
      localStorage.setItem('hqToken', result.token);
      setStatus({ busy: false, message: mode === 'register' ? 'Account created.' : 'Signed in.' });
      onAuthenticated(result.token);
    } catch (error) {
      setStatus({ busy: false, message: error.message });
    }
  };
  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <Logo dark />
    <p className="eyebrow">YOUR CONSISTENCY ADVENTURE</p>
    <h1>{mode === 'register' ? 'Begin with one small promise.' : 'Welcome back.'}</h1>
    {mode === 'register' && <Field label="Name"><input required maxLength="80" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>}
    <Field label="Email"><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
    <Field label="Password"><input required minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
    {status.message && <p className={status.message.endsWith('.') ? 'form-note' : 'form-error'}>{status.message}</p>}
    <button className="primary" disabled={status.busy}>{status.busy ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
    <button className="link-button" type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setStatus({ busy: false, message: '' }); }}>
      {mode === 'register' ? 'Already registered? Sign in' : 'New here? Create an account'}
    </button>
  </form></div>;
}

function Logo({ dark = false }) {
  return <div className={`hq-logo ${dark ? 'dark' : ''}`}><span><LeafLogo /></span> Habit<strong>Quest</strong></div>;
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }

function HabitForm({ habit, onClose, onSave }) {
  const [form, setForm] = useState(habit ? { ...habit, start_date: habit.created_on } : {
    name: '', description: '', category: 'Personal', schedule: 'daily', icon: '✦', start_date: todayIso(), target_days: 30, target_text: '', reminder_time: '',
  });
  const [error, setError] = useState('');
  const save = async event => {
    event.preventDefault();
    if (!form.name.trim()) { setError('Enter a habit name.'); return; }
    if (!form.schedule) { setError('Choose at least one weekday.'); return; }
    try { await onSave(form); onClose(); } catch (err) { setError(err.message); }
  };
  return <div className="modal-backdrop"><form className="modal goal-form" onSubmit={save}>
    <button className="close" type="button" aria-label="Close" onClick={onClose}>×</button>
    <p className="eyebrow">{habit ? 'EDIT GOAL' : 'NEW GOAL'}</p><h2>What do you want to achieve?</h2>
    <div className="form-grid">
      <Field label="Goal name"><input required maxLength="80" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Icon"><input maxLength="12" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /></Field>
      <Field label="Description"><input maxLength="240" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Category"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Study', 'Fitness', 'Health', 'Reading', 'Personal'].map(x => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Start date"><input type="date" max={todayIso()} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
      <Field label="Target duration"><select value={form.target_days} onChange={e => setForm({ ...form, target_days: Number(e.target.value) })}>{[7, 14, 21, 30, 60, 90].map(x => <option key={x} value={x}>{x} days</option>)}</select></Field>
      <Field label="Schedule"><select value={form.schedule === 'daily' ? 'daily' : 'selected'} onChange={e => setForm({ ...form, schedule: e.target.value === 'daily' ? 'daily' : '0,1,2,3,4' })}><option value="daily">Every day</option><option value="selected">Selected weekdays</option></select></Field>
      {form.schedule !== 'daily' && <fieldset className="weekday-field"><legend>Repeat on</legend>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => <label key={label}><input type="checkbox" checked={form.schedule.split(',').includes(String(index))} onChange={e => { const days = new Set(form.schedule.split(',')); e.target.checked ? days.add(String(index)) : days.delete(String(index)); setForm({ ...form, schedule: [...days].filter(Boolean).sort().join(',') }); }} />{label}</label>)}</fieldset>}
      <Field label="Daily target"><input placeholder="e.g. Solve 2 questions" maxLength="120" value={form.target_text} onChange={e => setForm({ ...form, target_text: e.target.value })} /></Field>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="primary">Save habit</button>
  </form></div>;
}

function Spark({ streak, completed, goalComplete = false }) {
  const state = goalComplete || streak >= 30 ? 'legend' : streak >= 7 ? 'party' : streak >= 3 ? 'charged' : completed ? 'happy' : 'idle';
  const messages = { idle: 'Ready for one small win?', happy: 'That counted. Nicely done!', charged: 'Your momentum is showing!', party: 'Seven days—what a rhythm!', legend: 'Goal complete. You made it real!' };
  const milestone = streak >= 30 ? 30 : streak >= 7 ? 14 : streak >= 3 ? 7 : 3;
  return <section className={`spark-card ${state}`} aria-label={`Spark mascot: ${messages[state]}`}>
    <div className="spark-copy"><h3>{streak ? `You're on a ${streak}-day streak!` : completed ? 'Nice work today!' : 'A fresh start today!'}</h3><p>{streak ? 'Complete today’s scheduled habits to keep it going.' : messages[state]}</p></div>
    <Owl className="spark-owl" mood={state === 'party' || state === 'legend' ? 'party' : 'happy'} />
    <div className="spark-milestone"><span>{streak} / {milestone} days to the next milestone</span><div className="goal-bar"><i style={{ width: `${Math.min(100, streak / milestone * 100)}%` }} /></div></div>
  </section>;
}

function Calendar({ token, selected, onSelect, day, revision, onToggle, pendingKey, showTasks = true }) {
  const [cursor, setCursor] = useState(() => new Date(`${selected}T12:00:00`));
  const [month, setMonth] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const chosen = new Date(`${selected}T12:00:00`);
    setCursor(current => current.getFullYear() === chosen.getFullYear() && current.getMonth() === chosen.getMonth() ? current : chosen);
  }, [selected]);
  useEffect(() => {
    api(`/calendar/${cursor.getFullYear()}/${cursor.getMonth() + 1}`, { token }).then(setMonth).catch(err => setError(err.message));
  }, [token, cursor, revision]);
  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const today = todayIso();
  return <section className="calendar-panel panel" id={showTasks ? 'daily-habits' : 'month-calendar'} tabIndex="-1">
    <div className="calendar-head"><div><h3>{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h3><div className="calendar-nav"><button aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button><button aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button></div></div><button className="calendar-today" onClick={() => { setCursor(new Date()); onSelect(today); }}>Today</button></div>
    <div className="calendar-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <span key={i}>{x}</span>)}</div>
    <div className="calendar-grid">{Array.from({ length: firstWeekday }, (_, i) => <i key={`empty-${i}`} />)}{month?.days.map(cell => {
      const future = cell.date > today; const complete = cell.scheduled > 0 && cell.completed === cell.scheduled;
      const state = future ? 'Future date' : !cell.scheduled ? 'Rest day' : complete ? 'Complete' : cell.completed ? 'Partially complete' : 'Missed';
      return <button key={cell.date} disabled={future} onClick={() => onSelect(cell.date)} aria-label={`${cell.date}, ${state}, ${cell.completed} of ${cell.scheduled} completed`} aria-pressed={selected === cell.date} className={`${selected === cell.date ? 'selected ' : ''}${today === cell.date ? 'today ' : ''}${complete ? 'complete ' : cell.scheduled && !cell.completed ? 'missed ' : cell.completed ? 'partial ' : ''}`} title={`${cell.date}: ${state}, ${cell.completed}/${cell.scheduled}`}>
        <b>{Number(cell.date.slice(-2))}</b><span className="category-dots" aria-hidden="true">{(cell.categories || []).slice(0, 4).map((category, index) => <i key={`${category}-${index}`} className={`category-dot category-${category.toLowerCase().replace(/[^a-z]/g, '')}`} />)}</span>
      </button>;
    })}</div>
    {error && <p className="form-error">{error}</p>}
    <div className="calendar-legend"><span><i className="status-complete" />Completed</span><span><i className="status-partial" />Partial</span><span><i className="status-missed" />Missed</span><span><i className="status-rest" />Rest day</span></div>
    {!!month?.days.some(cell => cell.categories?.length) && <div className="calendar-category-legend" aria-label="Habit category colors">{[...new Set(month.days.flatMap(cell => cell.categories || []))].map(category => <span key={category}><i className={`category-dot category-${category.toLowerCase().replace(/[^a-z]/g, '')}`} />{category}</span>)}</div>}
    {showTasks && <><div className="selected-day"><div><p className="eyebrow">SELECTED DATE</p><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div><b>{day?.date === selected ? `${day.completed}/${day.scheduled}` : '…'}</b></div>{day?.date === selected ? <HabitChecklist habits={day.habits} selected={selected} onToggle={onToggle} pendingKey={pendingKey} /> : <p className="task-loading">Loading saved tasks…</p>}</>}
  </section>;
}

function HabitChecklist({ habits, selected, onToggle, pendingKey, onEdit, onArchive, onDelete }) {
  if (!habits.length) return <div className="empty-state"><span>○</span><div><b>No habits scheduled</b><p>This is a rest day, not a missed day.</p></div></div>;
  return <div className="checklist">{habits.map(habit => <div className="task-row" key={habit.id}><button disabled={!habit.can_toggle || pendingKey === `${habit.id}:${selected}`} aria-pressed={habit.done} aria-label={`${habit.done ? 'Undo' : 'Complete'} ${habit.name} on ${selected}`} className={habit.done ? 'check-row done' : 'check-row'} onClick={() => onToggle(habit, selected)}>
    <span className={`habit-symbol category-${habit.category.toLowerCase().replace(/[^a-z]/g, '')}`}>{habit.icon || '✦'}</span><span><b>{habit.name}</b><small>{habit.description || (habit.schedule === 'daily' ? 'Every day' : 'Selected weekdays')}</small><em>{habit.category}</em></span><i>{habit.done ? '✓' : ''}</i>
  </button>{onEdit && <details className="task-menu"><summary aria-label={`Actions for ${habit.name}`}>···</summary><div><button onClick={() => onEdit(habit)}>Edit</button><button onClick={() => onArchive(habit)}>Archive</button><button onClick={() => onDelete(habit)}>Delete</button></div></details>}</div>)}</div>;
}

function TasksPanel({ day, selected, onToggle, pendingKey, onEdit, onArchive, onDelete, onViewAll }) {
  if (day?.date !== selected) return <section className="tasks-panel panel" id="daily-habits" tabIndex="-1"><h2>Tasks for {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2><p className="task-loading">Loading saved tasks…</p></section>;
  const total = day?.scheduled || 0;
  const done = day?.completed || 0;
  return <section className="tasks-panel panel" id="daily-habits" tabIndex="-1"><div className="panel-title"><div><h2>{selected === todayIso() ? 'Today’s Tasks' : `Tasks for ${new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</h2><p>{total} {total === 1 ? 'habit' : 'habits'} scheduled</p></div><span>{done}/{total} complete</span></div><div className="goal-bar"><i style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><HabitChecklist habits={day?.habits || []} selected={selected} onToggle={onToggle} pendingKey={pendingKey} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} /><button className="panel-link" onClick={onViewAll}>View all habits <span aria-hidden="true">→</span></button></section>;
}

function Heatmap({ activity, range, onRange, onSelect }) {
  const cells = activity?.cells || [];
  const padded = useMemo(() => padActivityCells(cells), [cells]);
  const months = useMemo(() => monthColumns(cells), [cells]);
  return <section className="heat-panel panel" id="consistency-heatmap" tabIndex="-1"><div className="panel-title"><div><h2>Activity Heatmap</h2><p>Each square shows your daily completion rate</p></div><select aria-label="Heatmap time range" value={range} onChange={e => onRange(Number(e.target.value))}><option value="84">12 weeks</option><option value="183">6 months</option><option value="365">1 year</option></select></div>
    <div className="heat-scroll"><div className="month-labels">{months.map(x => <span key={x.key} style={{ gridColumn: x.column }}>{x.label}</span>)}</div><div className="heat-body"><div className="heat-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div className="heat-grid">{padded.map((cell, index) => cell ? <button key={cell.date} className={cell.scheduled ? `level-${cell.intensity}` : 'rest-cell'} title={`${cell.date}: ${cell.scheduled ? `${cell.completed} completed of ${cell.scheduled} scheduled (${Math.round(100 * cell.completed / cell.scheduled)}%)` : 'rest day'}`} aria-label={`${cell.date}, ${cell.scheduled ? `${cell.completed} of ${cell.scheduled} scheduled habits completed` : 'rest day'}`} onClick={() => onSelect(cell.date)} /> : <i key={`pad-${index}`} />)}</div></div></div><div className="heat-footer"><div><b>{activity?.stats.completed || 0}</b> check-ins · <b>{activity?.stats.active_days || 0}</b> active days · <b>{activity?.stats.longest_habit_streak || 0}</b> best habit streak</div><div className="legend"><span>Missed</span>{[0, 1, 2, 3, 4].map(x => <i className={`level-${x}`} key={x} />)}<span>Complete</span><i className="rest-cell" />Rest</div></div>
  </section>;
}

function Achievements({ items, compact = false, onViewAll }) {
  const earned = items.filter(x => x.unlocked_on); const locked = items.filter(x => !x.unlocked_on);
  if (compact) return <section className="milestones panel"><div className="panel-title"><h2>Achievements</h2><button className="panel-link" onClick={onViewAll}>View all</button></div><div className="badge-grid compact">{[...earned.reverse(), ...locked].slice(0, 4).map(x => <Badge key={x.code} item={x} />)}</div></section>;
  return <div className="achievements-page"><p className="eyebrow">EARNED</p>{earned.length ? <div className="badge-grid">{earned.map(x => <Badge key={x.code} item={x} />)}</div> : <div className="empty-state roomy"><span>◇</span><div><b>No badges yet</b><p>Complete your first scheduled habit to begin.</p></div></div>}<p className="eyebrow locked-title">LOCKED · KEEP GOING</p><div className="badge-grid">{locked.map(x => <Badge key={x.code} item={x} />)}</div></div>;
}
function Badge({ item }) { const icon = item.code === 'first_step' ? '♧' : item.code === 'three_days' ? '♨' : item.code === 'seven_days' ? '✦' : item.unlocked_on ? '★' : '◇'; return <article className={`badge-card badge-${item.code} ${item.unlocked_on ? 'earned' : 'locked'}`}><span aria-hidden="true">{icon}</span><div><h3>{item.title}</h3><p>{item.description}</p><div className="badge-progress"><i style={{ width: `${Math.min(100, item.progress / item.target * 100)}%` }} /></div><small>{Math.min(item.progress, item.target)} / {item.target}</small></div></article>; }

function Trend({ title, rows, id }) { return <section className="panel chart-panel" id={id} tabIndex="-1"><div className="panel-title"><div><p className="eyebrow">SAVED ACTIVITY</p><h2>{title}</h2></div></div><div className="trend-chart">{rows.map(row => <div key={row.label} title={`${row.label}: ${row.completed}/${row.scheduled} · ${row.percentage}%`}><span style={{ height: `${row.percentage}%` }} /><small>{row.label.slice(-5)}</small></div>)}</div><p className="chart-note">Completion rate = completed scheduled occurrences ÷ scheduled occurrences. Empty periods are shown at zero.</p></section>; }
function WeeklyProgress({ activity }) {
  const [period, setPeriod] = useState('current');
  const today = activity?.cells?.at(-1)?.date;
  const previousSunday = today ? new Date(`${today}T12:00:00`) : null;
  if (previousSunday) previousSunday.setDate(previousSunday.getDate() - ((previousSunday.getDay() + 6) % 7) - 1);
  const previousDate = previousSunday ? `${previousSunday.getFullYear()}-${String(previousSunday.getMonth() + 1).padStart(2, '0')}-${String(previousSunday.getDate()).padStart(2, '0')}` : null;
  const days = today ? weekActivity(activity.cells, period === 'current' ? today : previousDate) : [];
  return <section className="weekly-panel panel" id="weekly-trend" tabIndex="-1"><div className="panel-title"><h2>Weekly Progress</h2><select aria-label="Weekly progress period" value={period} onChange={e => setPeriod(e.target.value)}><option value="current">This Week</option><option value="previous">Last Week</option></select></div><div className="weekly-chart">{days.map(({ label, date, cell, future }) => <div key={date} title={`${date}: ${future ? 'upcoming' : !cell ? 'activity unavailable' : cell.scheduled ? `${cell.completed}/${cell.scheduled} completed` : 'rest day'}`}><span className="weekly-column"><i className={!cell || future ? 'empty' : !cell.scheduled ? 'rest' : ''} style={{ height: cell?.scheduled ? `${completionRate(cell.completed, cell.scheduled)}%` : '0%' }} /></span><small>{label}</small></div>)}</div><p className="chart-note">Daily completion = completed scheduled habits ÷ scheduled habits.</p></section>;
}
function Progress({ dashboard, activity, analytics, range, setRange, onSelect, onStatAction }) {
  const ranked = [...analytics.habits].sort((a, b) => b.percentage - a.percentage || b.scheduled - a.scheduled);
  return <div className="progress-page"><StatCards dashboard={dashboard} activity={activity} onAction={onStatAction} /><div className="trend-layout"><Trend title="Last 30 days" rows={analytics.daily} /><Trend title="Last 8 weeks" rows={analytics.weekly} id="weekly-trend" /><Trend title="Last 6 months" rows={analytics.monthly} id="monthly-trend" /></div><Heatmap activity={activity} range={range} onRange={setRange} onSelect={onSelect} /><section className="panel insight-panel"><div><p className="eyebrow">LAST 30 DAYS</p><h2>Habits in focus</h2><p>Ranked by completed scheduled occurrences.</p>{ranked.length ? ranked.map(h => <div className="insight-row" key={h.id}><b>{h.name}</b><span>{h.completed}/{h.scheduled} · {h.percentage}%</span></div>) : <p>No scheduled habits in this period yet.</p>}</div><div><p className="eyebrow">BY CATEGORY</p><h2>Consistency</h2>{analytics.categories.map(c => <div className="insight-row" key={c.name}><b><i className={`category-dot category-${c.name.toLowerCase().replace(/[^a-z]/g, '')}`} />{c.name}</b><span>{c.completed}/{c.scheduled} · {c.percentage}%</span></div>)}</div></section></div>;
}

function HabitsPage({ habits, query, setQuery, onAdd, onEdit, onArchive, onRestore, onDelete, onQuickComplete }) {
  const [category, setCategory] = useState('all'); const [status, setStatus] = useState('active'); const [frequency, setFrequency] = useState('all'); const [sort, setSort] = useState('newest');
  const shown = habits.filter(h => h.name.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || h.category === category) && (status === 'all' || (status === 'active') === h.active) && (frequency === 'all' || (frequency === 'daily') === (h.schedule === 'daily'))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'consistency' ? b.completed_days - a.completed_days : b.id - a.id);
  return <section className="panel habits-page"><div className="toolbar"><input id="habit-search" aria-label="Search habits" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search habits" /><button className="primary" onClick={onAdd}>+ Add habit</button></div><div className="filters"><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All</option>{[...new Set(habits.map(h => h.category))].sort().map(x => <option key={x}>{x}</option>)}</select></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label><label>Frequency<select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="all">All</option><option value="daily">Daily</option><option value="selected">Selected days</option></select></label><label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="name">Name</option><option value="consistency">Most check-ins</option></select></label></div>{shown.length ? <div className="habit-library">{shown.map(h => <article key={h.id} className={!h.active ? 'archived' : ''}><span className={`library-icon category-${h.category.toLowerCase().replace(/[^a-z]/g, '')}`}>{h.icon}</span><div className="library-main"><div><h3>{h.name} {h.is_demo && <small>DEMO</small>}</h3><p>{h.category} · {h.schedule === 'daily' ? 'Every day' : 'Selected weekdays'}{h.description ? ` · ${h.description}` : ''}</p></div><div className="goal-meta"><span>{h.current} current streak</span><span>{h.longest} longest</span><span>{h.completed_days} check-ins</span>{!h.active && <span>Archived</span>}</div>{h.target_days > 0 && <div className="goal-bar"><i style={{ width: `${h.goal_progress}%` }} /></div>}</div><div className="row-actions">{h.active && h.scheduled_today && <button onClick={() => onQuickComplete(h)}>{h.done_today ? 'Undo today' : 'Complete today'}</button>}<button onClick={() => onEdit(h)}>Edit</button>{h.active ? <button onClick={() => onArchive(h)}>Archive</button> : <button onClick={() => onRestore(h)}>Restore</button>}<button className="danger" onClick={() => onDelete(h)}>Delete</button></div></article>)}</div> : <div className="empty-state roomy"><span>⌕</span><div><b>{habits.length ? 'No matching habits' : 'Your first habit starts here'}</b><p>{habits.length ? 'Adjust the search or filters.' : 'Add a habit to begin tracking your progress.'}</p><button className="primary" onClick={onAdd}>Add a habit</button></div></div>}</section>;
}

function QuickActions({ onAdd, navigate }) {
  return <section className="quick-panel panel"><h2>Quick Actions</h2><button className="primary" onClick={onAdd}>＋ Add Habit</button><button onClick={() => navigate('calendar')}>▦ &nbsp; View Calendar</button><button onClick={() => navigate('progress')}>⌁ &nbsp; Progress & Insights</button><button onClick={() => navigate('achievements')}>✦ &nbsp; View Achievements</button></section>;
}

function Challenges({ dashboard, onAdd }) {
  const challenge = dashboard.weekly_challenge;
  return <section className="challenges-page panel"><p className="eyebrow">THIS WEEK</p><h2>Show up, one day at a time.</h2><p>Complete at least one scheduled habit on {challenge.target} days this week.</p><strong>{challenge.active_days} of {challenge.target} active days</strong><div className="goal-bar"><i style={{ width: `${Math.min(100, challenge.active_days / challenge.target * 100)}%` }} /></div><h3>Your habit goals</h3>{dashboard.habits.filter(h => h.active).length ? dashboard.habits.filter(h => h.active).map(h => <div className="challenge-habit" key={h.id}><span>{h.icon}</span><div><b>{h.name}</b><small>{h.completed_days} / {h.target_days} check-ins toward this goal</small><div className="goal-bar"><i style={{ width: `${h.goal_progress}%` }} /></div></div></div>) : <div className="empty-state"><span>♧</span><div><b>No active goals yet</b><p>Add a habit to start a challenge.</p></div></div>}<button className="primary" onClick={onAdd}>+ Add Habit</button></section>;
}

function DashboardHome({ data, activity, token, selected, setSelected, day, revision, toggle, pendingKey, openStat, range, setRange, selectDate, navigate, onAdd, onEdit, onArchive, onDelete }) {
  return <><StatCards dashboard={data} activity={activity} onAction={openStat} /><div className="dashboard-main-grid"><Calendar token={token} selected={selected} onSelect={setSelected} day={day} revision={revision} onToggle={toggle} pendingKey={pendingKey} showTasks={false} /><TasksPanel day={day} selected={selected} onToggle={toggle} pendingKey={pendingKey} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} onViewAll={() => navigate('habits')} /><Spark streak={data.overall_streak} completed={data.today.completed > 0} goalComplete={data.habits.some(x => x.goal_complete)} /><div className="dashboard-actions"><QuickActions onAdd={onAdd} navigate={navigate} /><section className="quote-panel panel"><h2>Today’s thought</h2><p>“Small steps every day lead to big results.”</p><span aria-hidden="true">♧</span></section></div></div><div className="dashboard-bottom-grid"><Heatmap activity={activity} range={range} onRange={setRange} onSelect={selectDate} /><Achievements items={data.achievements} compact onViewAll={() => navigate('achievements')} /><WeeklyProgress activity={activity} /></div></>;
}

function Settings({ onDemo, onReset, message }) { return <section className="settings panel"><p className="eyebrow">HELP & SETTINGS</p><h2>Rules you can explain in your demo</h2><div className="rules"><p><b>Completion:</b> one unique user-owned habit and calendar date. It earns 20 XP once.</p><p><b>Undo:</b> removes only that date's record and reverses its completion XP.</p><p><b>Streak:</b> consecutive scheduled dates; rest days are skipped and future dates are ignored.</p><p><b>Level:</b> every 100 XP advances one level.</p><p><b>Archive:</b> preserves history while removing a goal from future schedules.</p></div><div className="demo-box"><h3>Demo Mode</h3><p>Generate clearly labelled habits and real completion records across four weeks, including genuine missed and completed days. Values are calculated by production logic and persist after refresh.</p><button className="primary" onClick={onDemo}>Load sample history</button><button className="link-button danger-text" onClick={onReset}>Reset sample data only</button>{message && <p className="form-note">{message}</p>}</div></section>; }

function App() {
  const [token, setToken] = useState(localStorage.getItem('hqToken') || '');
  const [page, setPage] = useState(location.hash.slice(1) || 'today');
  const [data, setData] = useState(null); const [day, setDay] = useState(null); const [activity, setActivity] = useState(null); const [analytics, setAnalytics] = useState(null);
  const [selected, setSelected] = useState(todayIso()); const [range, setRange] = useState(84); const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null); const [query, setQuery] = useState(''); const [toast, setToast] = useState(''); const [fatal, setFatal] = useState(''); const [celebration, setCelebration] = useState(null); const [pendingKey, setPendingKey] = useState('');
  const notify = text => { setToast(text); setTimeout(() => setToast(''), 2600); };
  const refresh = async () => {
    try {
      const [dashboard, selectedDay, activityData, analyticsData] = await Promise.all([api('/dashboard', { token }), api(`/days/${selected}`, { token }), api(`/activity?days=${range}`, { token }), api('/analytics', { token })]);
      setData(dashboard); setDay(selectedDay); setActivity(activityData); setAnalytics(analyticsData); setRevision(x => x + 1); setFatal('');
      const key = `hqSeen:${dashboard.user.name}`; const seen = JSON.parse(localStorage.getItem(key) || '[]'); const earned = dashboard.achievements.filter(x => x.unlocked_on).map(x => x.code); const fresh = dashboard.achievements.find(x => x.unlocked_on && !seen.includes(x.code));
      if (localStorage.getItem(key) && fresh) setCelebration(fresh);
      localStorage.setItem(key, JSON.stringify(earned));
    } catch (error) { if (error.message.includes('sign in')) { localStorage.removeItem('hqToken'); setToken(''); } else setFatal(error.message); }
  };
  useEffect(() => { if (token) refresh(); }, [token, selected, range]);
  useEffect(() => { const change = () => setPage(location.hash.slice(1) || 'today'); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change); }, []);
  const navigate = target => { location.hash = target; setPage(target); };
  const selectDate = date => { setSelected(date); navigate('today'); };
  const openStat = metric => {
    const target = { today: 'daily-habits', streak: 'consistency-heatmap', weekly: 'weekly-trend', monthly: 'monthly-trend' }[metric];
    if (metric === 'today') { setSelected(todayIso()); navigate('today'); }
    else navigate('progress');
    setTimeout(() => { const section = document.getElementById(target); section?.scrollIntoView({ behavior: 'smooth', block: 'start' }); section?.focus({ preventScroll: true }); }, 80);
  };
  const toggle = async (habit, date) => {
    const key = `${habit.id}:${date}`;
    if (pendingKey) return;
    setPendingKey(key);
    setDay(current => current?.date === date ? { ...current, completed: current.completed + (habit.done ? -1 : 1), habits: current.habits.map(item => item.id === habit.id ? { ...item, done: !item.done } : item) } : current);
    try {
      const result = await api(`/habits/${habit.id}/complete`, { token, method: habit.done ? 'DELETE' : 'POST', body: { completed_on: date } });
      notify(habit.done ? 'Completion undone.' : `Saved for ${date} · +${result.xp_awarded || 20} XP`);
      await refresh();
    } catch (error) {
      setDay(current => current?.date === date ? { ...current, completed: current.completed + (habit.done ? 1 : -1), habits: current.habits.map(item => item.id === habit.id ? { ...item, done: habit.done } : item) } : current);
      notify(error.message);
    } finally { setPendingKey(''); }
  };
  const quickToggle = async habit => { try { await api(`/habits/${habit.id}/complete`, { token, method: habit.done_today ? 'DELETE' : 'POST', body: { completed_on: todayIso() } }); notify(habit.done_today ? 'Today’s completion undone.' : 'Today’s completion saved.'); await refresh(); } catch (error) { notify(error.message); } };
  const saveHabit = async form => { await api(modal?.id ? `/habits/${modal.id}` : '/habits', { token, method: modal?.id ? 'PUT' : 'POST', body: form }); notify(modal?.id ? 'Goal updated.' : 'Goal created.'); await refresh(); };
  const archive = async habit => { if (confirm(`Archive “${habit.name}”? Its history will remain.`)) { try { await api(`/habits/${habit.id}/archive`, { token, method: 'POST' }); notify('Habit archived.'); await refresh(); } catch (error) { notify(error.message); } } };
  const restore = async habit => { try { await api(`/habits/${habit.id}/restore`, { token, method: 'POST' }); notify('Habit restored.'); await refresh(); } catch (error) { notify(error.message); } };
  const remove = async habit => { if (confirm(`Permanently delete “${habit.name}” and all its completion history?`)) { try { await api(`/habits/${habit.id}`, { token, method: 'DELETE' }); notify('Habit deleted.'); await refresh(); } catch (error) { notify(error.message); } } };
  const logout = async () => { try { await api('/auth/logout', { token, method: 'POST' }); } finally { localStorage.removeItem('hqToken'); setToken(''); setData(null); } };
  const demo = async reset => { if (reset && !confirm('Delete only the generated sample habits and history?')) return; try { const result = await api('/demo/sample', { token, method: reset ? 'DELETE' : 'POST' }); notify(reset ? 'Sample data removed.' : result.message); await refresh(); } catch (error) { notify(error.message); } };
  if (!token) return <Auth onAuthenticated={setToken} />;
  if (fatal) return <div className="auth-screen"><div className="auth-card"><h2>HabitQuest could not load</h2><p>{fatal}</p><button className="primary" onClick={refresh}>Try again</button></div></div>;
  if (!data || !day || !activity || !analytics) return <div className="loading">Loading your real progress…</div>;
  const nav = [['today', '⌂', 'Today'], ['habits', '◎', 'My Habits'], ['calendar', '▦', 'Calendar'], ['progress', '⌁', 'Progress'], ['achievements', '✦', 'Achievements'], ['challenges', '♧', 'Challenges'], ['settings', '⚙', 'Settings']];
  return <div className="app-shell"><aside className="sidebar"><Logo /><nav aria-label="Main navigation">{nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'nav active' : 'nav'} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav><div className="sidebar-companion"><Owl /><b>Small habits<br />Big progress!</b></div><div className="profile"><div className="avatar">{data.user.name[0].toUpperCase()}</div><div><b>{data.user.name}</b><small>Level {data.user.level} · {data.user.xp} XP</small></div></div><button className="support" onClick={logout}>↪ &nbsp; Sign out</button></aside><main className="workspace"><header className="hq-header"><div className="header-greeting"><span className="weather-art" aria-hidden="true"><svg viewBox="0 0 60 60"><circle cx="28" cy="27" r="13" fill="#ffc751"/><path d="M9 45c2-9 14-13 21-6 9-9 22-2 21 8H9Z" fill="#9ed8f4"/><path d="M28 2v7M7 24l6 2M45 8l-5 5" stroke="#f5b92e" strokeWidth="3" strokeLinecap="round"/></svg></span><div><h1>{page === 'today' ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${data.user.name}!` : page === 'habits' ? 'Your habit library.' : page === 'calendar' ? 'Your calendar.' : page === 'progress' ? 'Progress you actually made.' : page === 'achievements' ? 'Milestones, earned.' : page === 'challenges' ? 'Your challenges.' : 'Make HabitQuest yours.'}</h1><p>{page === 'today' ? 'Let’s make today count 🌿' : `Good to see you, ${data.user.name}.`}</p></div></div><div className="header-actions"><span className="header-date">▦ &nbsp; {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><label className="header-search"><span aria-hidden="true">⌕</span><input aria-label="Search habits" placeholder="Search habits..." value={query} onChange={e => { setQuery(e.target.value); navigate('habits'); }} onFocus={() => navigate('habits')} /></label><button className="primary" onClick={() => setModal({})}>＋ Add Habit</button></div></header>
    {page === 'today' && <DashboardHome data={data} activity={activity} token={token} selected={selected} setSelected={setSelected} day={day} revision={revision} toggle={toggle} pendingKey={pendingKey} openStat={openStat} range={range} setRange={setRange} selectDate={selectDate} navigate={navigate} onAdd={() => setModal({})} onEdit={h => setModal(data.habits.find(item => item.id === h.id))} onArchive={archive} onDelete={remove} />}
    {page === 'calendar' && <div className="calendar-page"><Calendar token={token} selected={selected} onSelect={setSelected} day={day} revision={revision} onToggle={toggle} pendingKey={pendingKey} /><Heatmap activity={activity} range={range} onRange={setRange} onSelect={selectDate} /></div>}
    {page === 'habits' && <HabitsPage habits={data.habits} query={query} setQuery={setQuery} onAdd={() => setModal({})} onEdit={setModal} onArchive={archive} onRestore={restore} onDelete={remove} onQuickComplete={quickToggle} />}
    {page === 'progress' && <Progress dashboard={data} activity={activity} analytics={analytics} range={range} setRange={setRange} onSelect={selectDate} onStatAction={openStat} />}
    {page === 'achievements' && <Achievements items={data.achievements} />}
    {page === 'challenges' && <Challenges dashboard={data} onAdd={() => setModal({})} />}
    {page === 'settings' && <Settings onDemo={() => demo(false)} onReset={() => demo(true)} message={toast} />}
  </main>{modal && <HabitForm habit={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveHabit} />}{toast && page !== 'settings' && <div className="toast">{toast}</div>}{celebration && <div className="celebration"><div><Spark streak={celebration.target || 1} completed /><p className="eyebrow">NEW MILESTONE</p><h2>{celebration.title}</h2><p>{celebration.description}</p><button className="primary" onClick={() => setCelebration(null)}>Keep going</button></div></div>}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
