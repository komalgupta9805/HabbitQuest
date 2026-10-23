import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './functional.css';
import './product.css';
import './redesign.css';
import './stat-cards.css';
import './reference.css';
import { monthColumns, padActivityCells } from './date-utils';
import { browserTimeZone } from './timezone';
import { normalizeHabitSelection, selectHabit } from './habit-selection';
import StatCards from './stat-cards';
import Owl, { LeafLogo } from './owl';
import { EmailNotificationSettings, NotificationCenter, useNotifications } from './notifications';
import './notifications.css';
import { PriorityControl, PriorityQuest } from './priorities.jsx';
import './priorities.css';

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const BRAND_NAME = 'Little Wins';
// Identity colours intentionally stay separate from the calendar's
// green/orange/red completion-status palette.
const HABIT_COLORS = [
  '#4F46E5', // Indigo
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EAB308', // Yellow
  '#A855F7', // Purple
  '#14B8A6', // Teal
  '#F472B6', // Light pink
  '#3B82F6', // Blue
  '#D946EF', // Magenta
  '#64748B', // Slate
  '#818CF8', // Light indigo
  '#0EA5E9', // Sky blue
];
const HABIT_ICONS = [
  ['water', 'Water'], ['exercise', 'Exercise'], ['walk', 'Walking'], ['book', 'Reading'], ['study', 'Studying'], ['code', 'Coding'],
  ['meditate', 'Meditation'], ['sleep', 'Sleep'], ['nutrition', 'Nutrition'], ['health', 'Health'], ['target', 'Goal'], ['sparkles', 'Other'],
];
const todayIso = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const plusDays = (iso, count) => { const value = new Date(`${iso}T12:00:00`); value.setDate(value.getDate() + count); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; };

async function api(path, { token, method = 'GET', body } = {}) {
  const timeZone = browserTimeZone();
  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(timeZone ? { 'X-Time-Zone': timeZone } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    const error = new Error(`Cannot reach the ${BRAND_NAME} API at ${API}. Check that the backend is running and this browser origin is allowed.`);
    error.cause = cause;
    error.status = 0;
    throw error;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = Array.isArray(data.detail) ? data.detail.map(item => item.msg).join(' ') : data.detail;
    const error = new Error(detail || `The ${BRAND_NAME} API returned ${response.status}. Please try again.`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function AppIcon({ name, size = 18, className = '' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': true };
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/></>,
    habits: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12 5 13.5 7.5 11M3.5 18 5 19.5 7.5 17"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    progress: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="m3 8 6-5 6 7 7-8"/></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M16 5.5a3 3 0 0 1 0 5.8M17 14a4 4 0 0 1 3.5 4v2"/></>,
    flag: <><path d="M5 21V4M5 5h12l-2 4 2 4H5"/></>, settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    water: <path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z"/>, exercise: <><path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/></>,
    walk: <><circle cx="13" cy="4" r="2"/><path d="m10 21 2-7-3-3 2-4 4 3 3 1M12 14l4 3 1 4M8 13l-3 4"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/></>,
    study: <><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v5c3 2 7 2 10 0v-5M21 9v6"/></>, code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 6l-4 12"/></>,
    meditate: <><circle cx="12" cy="5" r="2"/><path d="M12 8v5m0 0-4 3H4m8-3 4 3h4M8 11l4 2 4-2M7 20h10"/></>,
    sleep: <><path d="M4 18h16M5 18V7M19 18v-5a3 3 0 0 0-3-3H9v8M8 10V8H5"/></>, nutrition: <><path d="M12 7c-5-4-9 1-7 7 2 6 5 7 7 4 2 3 5 2 7-4 2-6-2-11-7-7Z"/><path d="M12 7c0-3 2-5 5-5"/></>,
    health: <><path d="M12 21S4 16.5 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 16.5 12 21 12 21Z"/><path d="M8 12h2l1-2 2 4 1-2h2"/></>, target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4V2M20 12h2"/></>, sparkles: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
  };
  return <svg {...common}>{paths[name] || paths.sparkles}</svg>;
}

function HabitGlyph({ name, size = 18 }) { return <AppIcon name={HABIT_ICONS.some(([id]) => id === name) ? name : 'sparkles'} size={size} />; }

function Auth({ onAuthenticated, inviteToken = '' }) {
  const resetToken = new URLSearchParams(location.search).get('reset_token') || '';
  const [mode, setMode] = useState(resetToken ? 'reset' : 'register');
  const [form, setForm] = useState({ name: '', email: '', password: '', invite_token: inviteToken });
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState({ busy: false, message: '' });
  const [invite, setInvite] = useState(inviteToken ? { loading: true } : null);
  useEffect(() => { if (inviteToken) api(`/invites/${encodeURIComponent(inviteToken)}`).then(setInvite).catch(error => setInvite({ error: error.message })); }, [inviteToken]);
  const submit = async (event) => {
    event.preventDefault();
    setStatus({ busy: true, message: '' });
    try {
      if (mode === 'forgot') {
        const result = await api('/auth/password-reset/request', { method: 'POST', body: { email: form.email } });
        setStatus({ busy: false, message: result.message });
      } else if (mode === 'reset') {
        if (form.password !== confirmation) throw new Error('Passwords do not match.');
        const result = await api('/auth/password-reset/confirm', { method: 'POST', body: { token: resetToken, password: form.password } });
        history.replaceState({}, '', location.pathname);
        setMode('login'); setConfirmation(''); setStatus({ busy: false, message: result.message });
      } else {
        const result = await api(`/auth/${mode}`, { method: 'POST', body: form });
        localStorage.setItem('hqToken', result.token);
        setStatus({ busy: false, message: mode === 'register' ? 'Account created.' : 'Signed in.' });
        onAuthenticated(result.token);
      }
    } catch (error) {
      setStatus({ busy: false, message: error.message });
    }
  };
  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}>
    <Logo dark />
    <p className="eyebrow">YOUR CONSISTENCY ADVENTURE</p>
    <h1>{mode === 'register' ? 'Begin with one small promise.' : mode === 'forgot' ? 'Reset your password.' : mode === 'reset' ? 'Choose a new password.' : 'Welcome back.'}</h1>
    {mode === 'register' && inviteToken && <p className={invite?.error ? 'form-error' : 'invite-note'}>{invite?.loading ? 'Checking your invitation…' : invite?.error || `${invite.inviter_display_name} invited you to ${BRAND_NAME}. Create an account to join; leaderboard participation stays optional.`}</p>}
    {mode === 'register' && <Field label="Name"><input required maxLength="80" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>}
    {mode !== 'reset' && <Field label="Email"><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>}
    {mode !== 'forgot' && <Field label={mode === 'reset' ? 'New password' : 'Password'}><input required minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>}
    {mode === 'reset' && <Field label="Confirm new password"><input required minLength="6" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></Field>}
    {status.message && <p className={status.message.endsWith('.') ? 'form-note' : 'form-error'}>{status.message}</p>}
    <button className="primary" disabled={status.busy}>{status.busy ? 'Working…' : mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Email reset link' : 'Update password'}</button>
    {mode === 'login' && <button className="link-button" type="button" onClick={() => { setMode('forgot'); setStatus({ busy: false, message: '' }); }}>Forgot password?</button>}
    {mode !== 'reset' && <button className="link-button" type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setStatus({ busy: false, message: '' }); }}>
      {mode === 'register' ? 'Already registered? Sign in' : 'New here? Create an account'}
    </button>}
    {mode === 'forgot' && <button className="link-button" type="button" onClick={() => { setMode('login'); setStatus({ busy: false, message: '' }); }}>Back to sign in</button>}
  </form></div>;
}

function Logo({ dark = false }) {
  return <div className={`hq-logo ${dark ? 'dark' : ''}`}><span><LeafLogo /></span> Little<strong>Wins</strong></div>;
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }

function HabitForm({ habit, onClose, onSave }) {
  const knownIcon = habit && HABIT_ICONS.some(([id]) => id === habit.icon) ? habit.icon : 'sparkles';
  const knownColor = habit && HABIT_COLORS.includes(habit.color) ? habit.color : HABIT_COLORS[(habit?.id || 0) % HABIT_COLORS.length];
  const [form, setForm] = useState(habit ? { ...habit, icon: knownIcon, color: knownColor, start_date: habit.created_on } : {
    name: '', description: '', category: 'Personal', schedule: 'daily', priority: 'Medium', icon: 'sparkles', color: HABIT_COLORS[0], start_date: todayIso(), target_days: 30, target_text: '', reminder_time: '',
  });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    if (!form.name.trim()) { setError('Enter a habit name.'); return; }
    if (!form.schedule) { setError('Choose at least one weekday.'); return; }
    setBusy(true);
    try { await onSave(form); onClose(); } catch (err) { setError(err.message); setBusy(false); }
  };
  return <div className="modal-backdrop"><form className="modal goal-form" onSubmit={save}>
    <button className="close" type="button" aria-label="Close" onClick={onClose}>×</button>
    <p className="eyebrow">{habit ? 'EDIT HABIT' : 'NEW HABIT'}</p><h2>What do you want to achieve?</h2>
    <div className="form-grid">
      <Field label="Goal name"><input required maxLength="80" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
      <fieldset className="icon-picker"><legend>Icon</legend><div>{HABIT_ICONS.map(([id, label]) => <button type="button" key={id} aria-label={`Use ${label} icon`} aria-pressed={form.icon === id} className={form.icon === id ? 'selected' : ''} title={label} onClick={() => setForm({ ...form, icon: id })}><HabitGlyph name={id} /><span>{label}</span></button>)}</div></fieldset>
      <Field label="Description"><input maxLength="240" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Category"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Study', 'Fitness', 'Health', 'Reading', 'Personal'].map(x => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Priority"><select value={form.priority || 'Medium'} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></Field>
      <fieldset className="color-field"><legend>Habit identity colour</legend><small>These stay distinct from green, orange and red task-status colours.</small><div>{HABIT_COLORS.map(color => <button type="button" key={color} aria-label={`Use ${color}`} aria-pressed={form.color === color} className={form.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })} />)}</div></fieldset>
      <Field label="Start date"><input type="date" max={todayIso()} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
      <Field label="Target duration"><select value={form.target_days} onChange={e => setForm({ ...form, target_days: Number(e.target.value) })}>{[7, 14, 21, 30, 60, 90].map(x => <option key={x} value={x}>{x} days</option>)}</select></Field>
      <Field label="Schedule"><select value={form.schedule === 'daily' ? 'daily' : 'selected'} onChange={e => setForm({ ...form, schedule: e.target.value === 'daily' ? 'daily' : '0,1,2,3,4' })}><option value="daily">Every day</option><option value="selected">Selected weekdays</option></select></Field>
      {form.schedule !== 'daily' && <fieldset className="weekday-field"><legend>Repeat on</legend>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => <label key={label}><input type="checkbox" checked={form.schedule.split(',').includes(String(index))} onChange={e => { const days = new Set(form.schedule.split(',')); e.target.checked ? days.add(String(index)) : days.delete(String(index)); setForm({ ...form, schedule: [...days].filter(Boolean).sort().join(',') }); }} />{label}</label>)}</fieldset>}
      <Field label="Target note"><input placeholder="e.g. Read before bed" maxLength="120" value={form.target_text} onChange={e => setForm({ ...form, target_text: e.target.value })} /></Field>
      <Field label="Measurable daily target (optional)"><input type="number" min="0.01" step="any" placeholder="e.g. 8" value={form.daily_target ?? ''} onChange={e => setForm({ ...form, daily_target: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
      <Field label="Target unit"><input maxLength="30" placeholder="glasses, pages, minutes…" value={form.target_unit || ''} onChange={e => setForm({ ...form, target_unit: e.target.value })} /></Field>
      <Field label="Reminder time (optional)"><input type="time" value={form.reminder_time || ''} onChange={e => setForm({ ...form, reminder_time: e.target.value })} /><small>Pending reminders appear after this time on scheduled, incomplete days while the app is open.</small></Field>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save habit'}</button>
  </form></div>;
}

function GoalForm({ goal, habits, onClose, onSave }) {
  const initialDays = goal ? Math.round((new Date(`${goal.end_on}T12:00:00`) - new Date(`${goal.start_on}T12:00:00`)) / 86400000) + 1 : 30;
  const [form, setForm] = useState(goal ? { ...goal } : { title: '', description: '', target_count: 7, start_on: todayIso(), end_on: plusDays(todayIso(), 29), habit_ids: [] });
  const [duration, setDuration] = useState(initialDays); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async event => { event.preventDefault(); if (!form.habit_ids.length) { setError('Choose at least one habit.'); return; } setBusy(true); try { await onSave(form, goal?.id); onClose(); } catch (err) { setError(err.message); setBusy(false); } };
  return <div className="modal-backdrop"><form className="modal goal-form" onSubmit={submit}><button className="close" type="button" aria-label="Close" onClick={onClose}>×</button><p className="eyebrow">{goal ? 'EDIT CHALLENGE' : 'NEW CHALLENGE'}</p><h2>Turn check-ins into a clear target.</h2><div className="form-grid"><Field label="Goal title"><input required maxLength="100" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field><Field label="Target check-ins"><input required type="number" min="1" max="10000" value={form.target_count} onChange={e => setForm({ ...form, target_count: Number(e.target.value) })} /></Field><Field label="Description"><input maxLength="300" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><Field label="Duration"><select value={duration} onChange={e => { const days = Number(e.target.value); setDuration(days); setForm({ ...form, end_on: plusDays(form.start_on, days - 1) }); }}>{[7, 14, 21, 30, 60, 90].map(days => <option key={days} value={days}>{days} days</option>)}</select></Field><Field label="Start date"><input type="date" value={form.start_on} onChange={e => setForm({ ...form, start_on: e.target.value, end_on: plusDays(e.target.value, duration - 1) })} /></Field></div><fieldset className="goal-habit-picker"><legend>Habits that count</legend>{habits.filter(h => h.active).map(h => <label key={h.id}><input type="checkbox" checked={form.habit_ids.includes(h.id)} onChange={e => setForm({ ...form, habit_ids: e.target.checked ? [...form.habit_ids, h.id] : form.habit_ids.filter(id => id !== h.id) })} /><HabitGlyph name={h.icon} /> {h.name}</label>)}</fieldset>{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save goal'}</button></form></div>;
}

function Spark({ streak, completed, goalComplete = false, compact = false }) {
  const state = goalComplete || streak >= 30 ? 'legend' : streak >= 7 ? 'party' : streak >= 3 ? 'charged' : completed ? 'happy' : 'idle';
  const messages = { idle: 'Ready for one small win?', happy: 'That counted. Nicely done!', charged: 'Your momentum is showing!', party: 'Seven days—what a rhythm!', legend: 'Goal complete. You made it real!' };
  const milestone = streak >= 30 ? 30 : streak >= 7 ? 14 : streak >= 3 ? 7 : 3;
  if (compact) return <section className={`compact-streak panel ${state}`} aria-label={`Current streak: ${streak} scheduled days`}><div className="compact-streak-copy"><p className="eyebrow">CURRENT STREAK</p><strong>{streak}<small> days</small></strong><span>{streak >= milestone ? 'Milestone reached' : `${milestone - streak} to the ${milestone}-day milestone`}</span><div className="goal-bar"><i style={{ width: `${Math.min(100, streak / milestone * 100)}%` }} /></div></div><Owl className="compact-streak-mascot" mood={state === 'party' || state === 'legend' ? 'party' : completed ? 'happy' : 'calm'} /></section>;
  return <section className={`spark-card ${state}`} aria-label={`Spark mascot: ${messages[state]}`}>
    <div className="spark-copy"><h3>{streak ? `You're on a ${streak}-day streak!` : completed ? 'Nice work today!' : 'A fresh start today!'}</h3><p>{streak ? 'Complete today’s scheduled habits to keep it going.' : messages[state]}</p></div>
    <Owl className="spark-owl" mood={state === 'party' || state === 'legend' ? 'party' : 'happy'} />
    <div className="spark-milestone"><span>{streak} / {milestone} days to the next milestone</span><div className="goal-bar"><i style={{ width: `${Math.min(100, streak / milestone * 100)}%` }} /></div></div>
  </section>;
}

function Calendar({ token, selected, onSelect, day, revision, onToggle, onProgress, pendingKey, showTasks = true }) {
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
      const state = future ? 'Future date' : !cell.scheduled ? 'Rest day' : complete ? 'Complete' : cell.completed || cell.partial ? 'Partially complete' : 'Missed';
      const activityText=(cell.activities || []).map(item => `${item.name}: ${item.status}`).join(', ');
      return <button key={cell.date} disabled={future} onClick={() => onSelect(cell.date)} aria-label={`${cell.date}, ${state}, ${cell.completed} of ${cell.scheduled} completed${activityText ? `. Activities: ${activityText}` : ''}`} aria-pressed={selected === cell.date} className={`${selected === cell.date ? 'selected ' : ''}${today === cell.date ? 'today ' : ''}${complete ? 'complete ' : cell.completed || cell.partial ? 'partial ' : cell.scheduled ? 'missed ' : ''}`} title={`${cell.date}: ${state}, ${cell.completed}/${cell.scheduled}${activityText ? ` · ${activityText}` : ''}`}>
        <b>{Number(cell.date.slice(-2))}</b><span className="activity-dots" aria-hidden="true">{(cell.activities || []).slice(0, 4).map((activity, index) => <i key={`${activity.name}-${index}`} style={{ background: activity.color }} />)}{cell.activities?.length > 4 && <small>+{cell.activities.length - 4}</small>}</span>
      </button>;
    })}</div>
    {error && <p className="form-error">{error}</p>}
    <div className="calendar-legend"><span><i className="status-complete" />Completed</span><span><i className="status-partial" />Partial</span><span><i className="status-missed" />Missed</span><span><i className="status-rest" />Rest day</span></div>
    {!!month?.days.some(cell => cell.activities?.length) && <div className="calendar-activity-legend" aria-label="Habit identity colors">{[...new Map(month.days.flatMap(cell => cell.activities || []).map(activity => [activity.name, activity])).values()].map(activity => <span key={activity.name}><i style={{ background: activity.color }} />{activity.name}</span>)}</div>}
    {showTasks && <><div className="selected-day"><div><p className="eyebrow">SELECTED DATE</p><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div><b>{day?.date === selected ? `${day.completed}/${day.scheduled}` : '…'}</b></div>{day?.date === selected ? <HabitChecklist habits={day.habits} selected={selected} onToggle={onToggle} onProgress={onProgress} pendingKey={pendingKey} /> : <p className="task-loading">Loading saved tasks…</p>}</>}
  </section>;
}

function ProgressControl({ habit, selected, onProgress, pending }) {
  const [value, setValue] = useState(habit.progress ?? '');
  useEffect(() => setValue(habit.progress ?? ''), [habit.progress, selected]);
  const save = event => { event.preventDefault(); if (value !== '') onProgress(habit, selected, Number(value)); };
  return <form className="task-progress" onSubmit={save}><label><span>Daily progress</span><input aria-label={`${habit.name} progress for ${selected}`} type="number" min="0" step="any" value={value} onChange={event => setValue(event.target.value)} /><b>/ {habit.daily_target} {habit.target_unit}</b></label><button disabled={pending || value === ''}>{pending ? 'Saving…' : habit.done ? 'Update' : 'Save'}</button></form>;
}

function HabitChecklist({ habits, selected, onToggle, onProgress, pendingKey, onEdit, onArchive, onDelete }) {
  if (!habits.length) return <div className="empty-state"><span>○</span><div><b>No habits scheduled</b><p>This is a rest day, not a missed day.</p></div></div>;
  return <div className="checklist">{habits.map(habit => <div className="task-row" key={habit.id}><button disabled={!habit.can_toggle || pendingKey === `${habit.id}:${selected}`} aria-pressed={habit.done} aria-label={`${habit.done ? 'Undo' : 'Complete'} ${habit.name} on ${selected}`} className={habit.done ? 'check-row done' : 'check-row'} onClick={() => onToggle(habit, selected)}>
    <span className="habit-symbol" style={{ color: habit.color, background: `${habit.color || HABIT_COLORS[0]}1F` }}><HabitGlyph name={habit.icon} /></span><span><b>{habit.name}</b><small>{habit.description || (habit.schedule === 'daily' ? 'Every day' : 'Selected weekdays')}</small><em>{habit.category}</em></span><i>{habit.done ? '✓' : ''}</i>
  </button>{onEdit && <details className="task-menu"><summary aria-label={`Actions for ${habit.name}`}>···</summary><div><button onClick={() => onEdit(habit)}>Edit</button><button onClick={() => onArchive(habit)}>Archive</button><button onClick={() => onDelete(habit)}>Delete</button></div></details>}{habit.daily_target && onProgress && <ProgressControl habit={habit} selected={selected} onProgress={onProgress} pending={pendingKey === `progress:${habit.id}:${selected}`} />}</div>)}</div>;
}

function TasksPanel({ day, selected, onToggle, onProgress, pendingKey, onEdit, onArchive, onDelete, onViewAll }) {
  if (day?.date !== selected) return <section className="tasks-panel panel" id="daily-habits" tabIndex="-1"><h2>Tasks for {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2><p className="task-loading">Loading saved tasks…</p></section>;
  const total = day?.scheduled || 0;
  const done = day?.completed || 0;
  return <section className="tasks-panel panel" id="daily-habits" tabIndex="-1"><div className="panel-title"><div><h2>{selected === todayIso() ? 'Today’s Tasks' : `Tasks for ${new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}</h2><p>{total} {total === 1 ? 'habit' : 'habits'} scheduled</p></div><span>{done}/{total} complete</span></div><div className="goal-bar"><i style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><HabitChecklist habits={day?.habits || []} selected={selected} onToggle={onToggle} onProgress={onProgress} pendingKey={pendingKey} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} /><button className="panel-link" onClick={onViewAll}>View all habits <span aria-hidden="true">→</span></button></section>;
}

function HabitHeatmapCard({ habit, onSelect }) {
  const padded = useMemo(() => padActivityCells(habit.cells), [habit.cells]);
  const months = useMemo(() => monthColumns(habit.cells), [habit.cells]);
  const detail = cell => cell.status === 'complete' ? 'completed' : cell.status === 'partial' ? `partial${cell.recorded_value == null ? '' : ` · ${cell.recorded_value}${habit.target_unit ? ` ${habit.target_unit}` : ''}`}` : cell.status === 'missed' ? 'scheduled but missed' : cell.status === 'future' ? 'future date' : 'rest day';
  return <article className="habit-heat-card" style={{ '--habit-color': habit.color }}><header><div><span className="habit-color-dot" /><div><h3><HabitGlyph name={habit.icon} /> {habit.name}</h3><p>{habit.schedule === 'daily' ? 'Every day' : 'Selected weekdays'}</p></div></div><strong>{habit.stats.completion_rate}%</strong></header><div className="habit-heat-scroll"><div className="habit-month-labels">{months.map(item => <span key={item.key} style={{ gridColumn: item.column }}>{item.label}</span>)}</div><div className="habit-heat-body"><div className="habit-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div className="habit-heat-grid">{padded.map((cell, index) => cell ? <button key={cell.date} className={`${cell.status} intensity-${cell.intensity}`} disabled={cell.status === 'future'} title={`${cell.date}: ${detail(cell)}${cell.note ? ` · ${cell.note}` : ''}`} aria-label={`${habit.name}, ${cell.date}, ${detail(cell)}`} onClick={() => onSelect(cell.date)} /> : <i key={`pad-${index}`} />)}</div></div></div><dl className="habit-heat-stats"><div><dt>Current</dt><dd>{habit.stats.current_streak} days</dd></div><div><dt>Best</dt><dd>{habit.stats.best_streak} days</dd></div><div><dt>Completed</dt><dd>{habit.stats.completed}/{habit.stats.scheduled}</dd></div><div><dt>This week</dt><dd>{habit.stats.weekly.percentage}%</dd></div><div><dt>This month</dt><dd>{habit.stats.monthly.percentage}%</dd></div></dl></article>;
}

function HabitTracking({ habits, activity, loading, error, selectedIds, onSelection, range, onRange, onSelect, onAdd }) {
  const active = habits.filter(habit => habit.active);
  return <section className="habit-tracking panel" id="habit-tracking" tabIndex="-1"><div className="panel-title habit-tracking-head"><div><p className="eyebrow">INDIVIDUAL HISTORY</p><h2>Habit Activity</h2><p>Choose one habit to inspect its saved history. Its identity colour is separate from task status.</p></div><div className="habit-tracking-controls">{active.length > 0 && <label className="habit-selector">Select habit<select aria-label="Select habit" value={selectedIds[0] || ''} onChange={event => onSelection(selectHabit(event.target.value))}>{active.map(habit => <option key={habit.id} value={habit.id}>{habit.name}</option>)}</select></label>}<select aria-label="Habit history range" value={range} onChange={event => onRange(Number(event.target.value))}><option value="84">12 weeks</option><option value="183">6 months</option><option value="365">1 year</option></select></div></div>{!active.length ? <div className="empty-state roomy"><Owl mood="calm" /><div><b>Your first habit will appear here</b><p>Use the Add Habit button at the top to begin tracking.</p></div></div> : loading ? <p className="activity-message">Loading individual habit history…</p> : error ? <p className="form-error">{error}</p> : activity?.habits?.length ? <div className="habit-heat-grid-layout">{activity.habits.map(habit => <HabitHeatmapCard key={habit.id} habit={habit} onSelect={onSelect} />)}</div> : <div className="empty-state"><span>◎</span><div><b>Select a habit</b><p>Your saved data remains available when a habit is not displayed.</p></div></div>}<div className="habit-heat-legend"><span><i className="complete" />Complete</span><span><i className="partial" />Partial</span><span><i className="missed" />Missed</span><span><i className="rest" />Rest day</span></div></section>;
}

const achievementIcons = { leaf: '❧', flame: '♨', shield: '◆', plant: '♜', medal: '★' };
function Badge({ item, onOpen, featured = false }) {
  const percent = Math.min(100, item.progress / item.target * 100);
  const isEarned = Boolean(item.display_unlocked ?? item.unlocked_on);
  const earnedEarlier = isEarned && item.unlocked_on && item.progress < item.target;
  return <button type="button" className={`achievement-card accent-${item.accent} ${isEarned ? 'earned' : 'locked'} ${featured ? 'featured' : ''}`} onClick={() => onOpen(item)}><span className="achievement-emblem" aria-hidden="true">{achievementIcons[item.emblem] || '✦'}</span><span className="achievement-copy"><span className="achievement-status">{isEarned ? earnedEarlier ? '✓ Earned earlier' : '✓ Earned' : `${item.remaining} to go`}</span><strong>{item.title}</strong><small>{item.description}</small><span className="badge-progress"><i style={{ width: `${percent}%` }} /></span><span className="achievement-foot"><span>{item.progress} / {item.target}</span><span>+{item.reward_xp} XP</span></span><small className="achievement-calculation">{item.calculation}</small></span></button>;
}
function Achievements({ items }) {
  const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('closest'); const [detail, setDetail] = useState(null);
  const isEarned = item => Boolean(item.display_unlocked ?? item.unlocked_on);
  const earned = items.filter(isEarned); const unlockedPercent = items.length ? Math.round(100 * earned.length / items.length) : 0;
  const next = [...items].filter(item => !isEarned(item)).sort((a, b) => (a.remaining / a.target) - (b.remaining / b.target))[0];
  const latest = [...earned].sort((a, b) => b.unlocked_on.localeCompare(a.unlocked_on))[0];
  const filtered = items.filter(item => filter === 'all' || (filter === 'earned') === isEarned(item)).sort((a, b) => sort === 'recent' ? (b.unlocked_on || '').localeCompare(a.unlocked_on || '') : (a.remaining / a.target) - (b.remaining / b.target));
  const groups = [...new Set(filtered.map(item => item.category))];
  return <div className="achievements-page"><section className="achievement-hero"><div><p className="eyebrow">YOUR MILESTONE JOURNEY</p><h2>Small wins become lasting rewards.</h2><p>Every badge below is calculated from your saved completions and scheduled streaks.</p><div className="achievement-summary"><strong>{earned.length} of {items.length} unlocked</strong><span>{unlockedPercent}% complete</span></div></div><div className="achievement-ring" style={{ '--earned': `${unlockedPercent * 3.6}deg` }}><span>{unlockedPercent}%</span></div><Owl mood={earned.length ? 'party' : 'happy'} /></section>
    {latest && <section className="recent-unlock panel"><div><p className="eyebrow">RECENTLY UNLOCKED</p><h2>{latest.title}</h2><p>Earned {new Date(`${latest.unlocked_on}T12:00:00`).toLocaleDateString()} · +{latest.reward_xp} XP reward</p></div><Badge item={latest} featured onOpen={setDetail} /></section>}
    {next && <section className="next-milestone panel"><div><p className="eyebrow">NEXT MILESTONE</p><h2>{next.title}</h2><p>{next.remaining} more {next.metric === 'best' ? 'scheduled streak days' : 'completions'} to unlock this reward.</p></div><div><strong>{next.progress}/{next.target}</strong><div className="badge-progress"><i style={{ width: `${next.progress / next.target * 100}%` }} /></div></div></section>}
    <div className="achievement-toolbar" role="group" aria-label="Achievement filters">{[['all','All'],['earned','Earned'],['progress','In progress']].map(([id,label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}<label>Sort <select value={sort} onChange={event => setSort(event.target.value)}><option value="closest">Closest to unlock</option><option value="recent">Recently unlocked</option></select></label></div>
    {groups.map(group => <section className="achievement-group" key={group}><div className="panel-title"><div><p className="eyebrow">REWARD COLLECTION</p><h2>{group}</h2></div></div><div className="achievement-grid">{filtered.filter(item => item.category === group).map(item => <Badge key={item.code} item={item} onOpen={setDetail} />)}</div></section>)}
    {!filtered.length && <div className="empty-state roomy"><span>✦</span><div><b>No achievements in this view</b><p>Choose another filter to see your milestone journey.</p></div></div>}
    {detail && <AchievementDetail detail={detail} onClose={() => setDetail(null)} isEarned={isEarned(detail)} />}
  </div>;
}

function AchievementDetail({ detail, onClose, isEarned }) {
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className={`modal achievement-detail accent-${detail.accent}`} role="dialog" aria-modal="true" aria-labelledby="achievement-detail-title"><button className="close" aria-label="Close achievement details" onClick={onClose}>×</button><span className="achievement-emblem" aria-hidden="true">{achievementIcons[detail.emblem]}</span><p className="eyebrow">{isEarned ? 'ACHIEVEMENT EARNED' : 'MILESTONE IN PROGRESS'}</p><h2 id="achievement-detail-title">{detail.title}</h2><p>{detail.description}</p><p><b>Requirement:</b> {detail.requirement}</p><p><b>Calculated from:</b> {detail.calculation}</p><div className="badge-progress"><i style={{ width: `${detail.progress / detail.target * 100}%` }} /></div><p>{detail.progress} of {detail.target} · {isEarned ? `Earned ${detail.unlocked_on}${detail.progress < detail.target ? '; the badge stays earned after a later undo.' : ''}` : `${detail.remaining} remaining`} · +{detail.reward_xp} XP</p></section></div>;
}

function Leaderboard({ board, period, onPeriod, onParticipation, busy, token }) {
  const [invite, setInvite] = useState(null); const [inviteBusy, setInviteBusy] = useState(false); const [feedback, setFeedback] = useState('');
  const createInvite = async () => { setInviteBusy(true); setFeedback(''); try { const result = await api('/invites', { token, method: 'POST' }); setInvite({ ...result, link: `${location.origin}${location.pathname}?invite=${encodeURIComponent(result.token)}` }); } catch (error) { setFeedback(error.message); } finally { setInviteBusy(false); } };
  const copyLink = async () => { try { await navigator.clipboard.writeText(invite.link); setFeedback('Invite link copied. Nothing was sent automatically.'); } catch { setFeedback('Copy failed. Select the link and copy it manually.'); } };
  const shareInvite = async () => { if (!navigator.share) { await copyLink(); return; } try { await navigator.share({ title: `Join me on ${BRAND_NAME}`, text: `Join me on ${BRAND_NAME} to build small habits together. Register, then opt in if you want to appear on the leaderboard.`, url: invite.link }); setFeedback('Share completed.'); } catch (error) { if (error.name !== 'AbortError') setFeedback('Sharing was not available. You can copy the link instead.'); } };
  const revokeInvite = async () => { try { await api(`/invites/${encodeURIComponent(invite.token)}`, { token, method: 'DELETE' }); setFeedback('Invite revoked. The link can no longer be used.'); setInvite(null); } catch (error) { setFeedback(error.message); } };
  return <section className="leaderboard-page"><div className="leaderboard-hero panel"><div><p className="eyebrow">OPTIONAL COMMUNITY RANKING</p><h2>Leaderboard</h2><p>Only members who opt in appear here. Names, levels and earned XP are shown—never email addresses or account IDs.</p><button className="primary invite-button" onClick={createInvite} disabled={inviteBusy}><AppIcon name="users" />{inviteBusy ? 'Creating…' : 'Invite Friends'}</button></div><Owl mood="happy" /></div><div className="leaderboard-controls"><div role="group" aria-label="Leaderboard period"><button className={period === 'all_time' ? 'active' : ''} onClick={() => onPeriod('all_time')}>All-time XP</button><button className={period === 'week' ? 'active' : ''} onClick={() => onPeriod('week')}>This week</button></div><label><input type="checkbox" checked={Boolean(board?.participating)} disabled={busy} onChange={event => onParticipation(event.target.checked)} /> Join the leaderboard</label></div>{feedback && <p className="leaderboard-note" role="status">{feedback}</p>}{board?.participating && <p className="leaderboard-note">{board.my_rank ? `Your current rank is #${board.my_rank}.` : 'Your rank will appear after your participation is saved.'}</p>}{board?.entries?.length ? <div className="leaderboard-table panel"><div className="leaderboard-row heading"><span>Rank</span><span>Member</span><span>Level</span><span>{board.score_label}</span></div>{board.entries.map(entry => <div className="leaderboard-row" key={`${entry.rank}-${entry.display_name}`}><strong>#{entry.rank}</strong><span className="leaderboard-person"><i>{entry.avatar}</i>{entry.display_name}</span><span>Level {entry.level}</span><b>{entry.score} XP</b></div>)}</div> : <div className="empty-state roomy"><Owl mood="calm" /><div><b>The leaderboard is ready for its first members</b><p>Opt in if you want to appear. It will grow only when real {BRAND_NAME} users choose to join.</p></div></div>}{invite && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setInvite(null)}><section className="modal invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title"><button className="close" aria-label="Close invite dialog" onClick={() => setInvite(null)}>×</button><p className="eyebrow">INVITE FRIENDS</p><h2 id="invite-title">Build little wins together.</h2><p>Send this link to a friend. It expires in 7 days. They must register and separately opt in before appearing on the leaderboard.</p><label>Shareable invite link<input readOnly value={invite.link} onFocus={event => event.target.select()} /></label><div className="invite-actions"><button className="primary" onClick={copyLink}>Copy Link</button>{typeof navigator.share === 'function' && <button onClick={shareInvite}>Share…</button>}<button className="danger-text" onClick={revokeInvite}>Revoke link</button></div>{feedback && <p className="form-note" role="status">{feedback}</p>}</section></div>}</section>;
}

function Trend({ title, rows, id }) { return <section className="panel chart-panel" id={id} tabIndex="-1"><div className="panel-title"><div><p className="eyebrow">SAVED ACTIVITY</p><h2>{title}</h2></div></div><div className="trend-chart">{rows.map(row => <div key={row.label} title={`${row.label}: ${row.completed}/${row.scheduled} · ${row.percentage}%`}><span style={{ height: `${row.percentage}%` }} /><small>{row.label.slice(-5)}</small></div>)}</div><p className="chart-note">Completion rate = completed scheduled occurrences ÷ scheduled occurrences. Empty periods are shown at zero.</p></section>; }
function Progress({ dashboard, activity, analytics, insights, range, setRange, onSelect, onStatAction }) {
  const ranked = [...analytics.habits].sort((a, b) => b.percentage - a.percentage || b.scheduled - a.scheduled);
  return <div className="progress-page"><StatCards dashboard={dashboard} activity={activity} onAction={onStatAction} /><div className="trend-layout"><Trend title="Last 30 days" rows={analytics.daily} /><Trend title="Last 8 weeks" rows={analytics.weekly} id="weekly-trend" /><Trend title="Last 6 months" rows={analytics.monthly} id="monthly-trend" /></div><section className="panel insight-panel"><div><p className="eyebrow">EXPLAINABLE INSIGHTS</p><h2>Patterns from your check-ins</h2>{insights.length ? insights.map((item, index) => <div className="insight-row insight-copy" key={`${item.type}-${index}`}><b>{item.title}</b><span>{item.explanation}</span><small>{item.action}</small></div>) : <p>Keep checking in. {BRAND_NAME} waits for enough real history before making a suggestion.</p>}</div><div><p className="eyebrow">LAST 30 DAYS</p><h2>Habits in focus</h2>{ranked.length ? ranked.map(h => <div className="insight-row" key={h.id}><b>{h.name}</b><span>{h.completed}/{h.scheduled} · {h.percentage}%</span></div>) : <p>No scheduled habits in this period yet.</p>}<p className="eyebrow locked-title">BY CATEGORY</p>{analytics.categories.map(c => <div className="insight-row" key={c.name}><b><i className={`category-dot category-${c.name.toLowerCase().replace(/[^a-z]/g, '')}`} />{c.name}</b><span>{c.completed}/{c.scheduled} · {c.percentage}%</span></div>)}</div></section></div>;
}

function HabitsPage({ habits, query, setQuery, onEdit, onArchive, onRestore, onDelete, onQuickComplete, onPriorityChange, prioritySavingId }) {
  const [category, setCategory] = useState('all'); const [status, setStatus] = useState('active'); const [frequency, setFrequency] = useState('all'); const [sort, setSort] = useState('newest');
  const shown = habits.filter(h => h.name.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || h.category === category) && (status === 'all' || (status === 'active') === h.active) && (frequency === 'all' || (frequency === 'daily') === (h.schedule === 'daily'))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'consistency' ? b.completed_days - a.completed_days : b.id - a.id);
  return <section className="panel habits-page"><div className="toolbar"><input id="habit-search" aria-label="Search habits" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search habits" /></div><div className="filters"><label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All</option>{[...new Set(habits.map(h => h.category))].sort().map(x => <option key={x}>{x}</option>)}</select></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label><label>Frequency<select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="all">All</option><option value="daily">Daily</option><option value="selected">Selected days</option></select></label><label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="name">Name</option><option value="consistency">Most check-ins</option></select></label></div>{shown.length ? <div className="habit-library">{shown.map(h => <article key={h.id} className={!h.active ? 'archived' : ''}><span className="library-icon" style={{ color: h.color, background: `${h.color}1F` }}><HabitGlyph name={h.icon} size={21} /></span><div className="library-main"><div><h3>{h.name} {h.is_demo && <small>DEMO</small>}</h3><p><i className="habit-color-dot" style={{ background: h.color }} />{h.category} · {h.schedule === 'daily' ? 'Every day' : 'Selected weekdays'}{h.description ? ` · ${h.description}` : ''}</p></div><div className="goal-meta"><span>{h.current} current streak</span><span>{h.longest} longest</span><span>{h.completed_days} check-ins</span>{h.daily_target && <span>{h.daily_target} {h.target_unit} daily</span>}{!h.active && <span>Archived</span>}</div>{h.target_days > 0 && <div className="goal-bar"><i style={{ width: `${h.goal_progress}%`, background: h.color }} /></div>}</div><PriorityControl habit={h} onChange={onPriorityChange} saving={prioritySavingId !== null} /><div className="row-actions">{h.active && h.scheduled_today && (!h.daily_target || h.done_today) && <button onClick={() => onQuickComplete(h)}>{h.done_today ? 'Undo today' : 'Complete today'}</button>}<button onClick={() => onEdit(h)}>Edit</button>{h.active ? <button onClick={() => onArchive(h)}>Archive</button> : <button onClick={() => onRestore(h)}>Restore</button>}<button className="danger" onClick={() => onDelete(h)}>Delete</button></div></article>)}</div> : <div className="empty-state roomy"><span>⌕</span><div><b>{habits.length ? 'No matching habits' : 'Your first habit starts here'}</b><p>{habits.length ? 'Adjust the search or filters.' : 'Use the Add Habit button at the top to begin tracking.'}</p></div></div>}</section>;
}

function Challenges({ dashboard, goals, onAdd, onAddGoal, onEditGoal, onGoalAction, onDeleteGoal }) {
  const challenge = dashboard.weekly_challenge;
  const target = challenge.target || 0;
  return <section className="challenges-page panel"><p className="eyebrow">THIS WEEK</p><h2>Show up, one day at a time.</h2><p>{target ? `Your weekly target is ${target} active ${target === 1 ? 'day' : 'days'}, based on ${challenge.scheduled_days} day${challenge.scheduled_days === 1 ? '' : 's'} with at least one scheduled habit this week.` : 'Add a scheduled habit to begin a weekly consistency goal.'}</p><strong>{challenge.active_days} of {target} active days</strong><div className="goal-bar"><i style={{ width: `${target ? Math.min(100, challenge.active_days / target * 100) : 0}%` }} /></div><div className="panel-title goal-list-title"><div><h3>Your saved goals</h3><p className="goal-explainer">Each goal counts completed check-ins from its selected habits within its own date range.</p></div><button className="primary" onClick={onAddGoal}>+ New goal</button></div>{goals.length ? goals.map(goal => <article className="saved-goal" key={goal.id}><div><b>{goal.title}</b><small>{goal.completed} of {goal.target_count} check-ins · {goal.status}</small></div><small className="goal-period">Counting {new Date(`${goal.start_on}T12:00:00`).toLocaleDateString()}–{new Date(`${goal.end_on}T12:00:00`).toLocaleDateString()}</small><div className="goal-bar"><i style={{ width: `${goal.percentage}%` }} /></div><div className="row-actions"><button onClick={() => onEditGoal(goal)}>Edit</button>{goal.status === 'active' && <button onClick={() => onGoalAction(goal, 'pause')}>Pause</button>}{goal.status === 'paused' && <button onClick={() => onGoalAction(goal, 'resume')}>Resume</button>}{goal.status !== 'completed' && <button onClick={() => onGoalAction(goal, 'complete')}>Complete</button>}<button className="danger" onClick={() => onDeleteGoal(goal)}>Delete</button></div></article>) : <div className="empty-state"><span>◆</span><div><b>No saved goals yet</b><p>Group one or more habits into a measurable challenge.</p></div></div>}<h3>Your habit targets</h3>{dashboard.habits.filter(h => h.active).length ? dashboard.habits.filter(h => h.active).map(h => <div className="challenge-habit" key={h.id}><span><HabitGlyph name={h.icon} size={23} /></span><div><b>{h.name}</b><small>{h.completed_days} / {h.target_days} check-ins toward this habit target</small><div className="goal-bar"><i style={{ width: `${h.goal_progress}%` }} /></div></div></div>) : <div className="empty-state"><span>◎</span><div><b>No active habits yet</b><p>Add a habit to start tracking.</p></div></div>}<button onClick={onAdd}>+ Add Habit</button></section>;
}

function DashboardHome({ data, activity, habitActivity, habitActivityLoading, habitActivityError, trackedHabitIds, setTrackedHabitIds, token, selected, setSelected, day, revision, toggle, saveProgress, pendingKey, openStat, range, setRange, selectDate, navigate, onAdd, onEdit, onArchive, onDelete, onPriorityChange, prioritySavingId, priorityFeedback }) {
  return <><StatCards dashboard={data} activity={activity} onAction={openStat} /><PriorityQuest habits={data.habits} onPriorityChange={onPriorityChange} savingId={prioritySavingId} feedback={priorityFeedback} onOpenHabits={() => navigate('habits')} /><div className="dashboard-main-grid"><Calendar token={token} selected={selected} onSelect={setSelected} day={day} revision={revision} onToggle={toggle} onProgress={saveProgress} pendingKey={pendingKey} showTasks={false} /><TasksPanel day={day} selected={selected} onToggle={toggle} onProgress={saveProgress} pendingKey={pendingKey} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} onViewAll={() => navigate('habits')} /><Spark compact streak={data.overall_streak} completed={data.today.completed > 0} goalComplete={data.habits.some(x => x.goal_complete)} /></div><HabitTracking habits={data.habits} activity={habitActivity} loading={habitActivityLoading} error={habitActivityError} selectedIds={trackedHabitIds} onSelection={setTrackedHabitIds} range={range} onRange={setRange} onSelect={selectDate} onAdd={onAdd} /></>;
}

function Settings({ onDemo, onReset, message, notifications, user }) { return <section className="settings panel settings-simple"><p className="eyebrow">SETTINGS</p><EmailNotificationSettings state={notifications} user={user} /><h2>Demo Mode</h2><div className="demo-box"><h3>Sample history for presentations</h3><p>Load clearly labelled sample habits and genuine date-specific completion records. Reset removes only records created by Demo Mode; your own habits and history remain untouched.</p><div><button className="primary" onClick={onDemo}>Load sample history</button><button className="link-button danger-text" onClick={onReset}>Reset sample data only</button></div>{message && <p className="form-note">{message}</p>}</div></section>; }

function App() {
  const inviteToken = new URLSearchParams(location.search).get('invite') || '';
  const [token, setToken] = useState(localStorage.getItem('hqToken') || '');
  const [page, setPage] = useState(location.hash.slice(1) || 'today');
  const [data, setData] = useState(null); const [day, setDay] = useState(null); const [activity, setActivity] = useState(null); const [analytics, setAnalytics] = useState(null); const [insights, setInsights] = useState([]); const [goals, setGoals] = useState([]);
  const [trackedHabitIds, setTrackedHabitIds] = useState(() => { try { return JSON.parse(localStorage.getItem('hqTrackedHabitIds') || '[]'); } catch { return []; } });
  const [habitActivity, setHabitActivity] = useState(null); const [habitActivityLoading, setHabitActivityLoading] = useState(false); const [habitActivityError, setHabitActivityError] = useState('');
  const [leaderboard, setLeaderboard] = useState(null); const [leaderboardPeriod, setLeaderboardPeriod] = useState('all_time'); const [leaderboardBusy, setLeaderboardBusy] = useState(false);
  const [me, setMe] = useState(null);
  const notifications = useNotifications(api, token, me);
  const [selected, setSelected] = useState(todayIso()); const [range, setRange] = useState(84); const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null); const [goalModal, setGoalModal] = useState(null); const [query, setQuery] = useState(''); const [toast, setToast] = useState(''); const [fatal, setFatal] = useState(''); const [celebration, setCelebration] = useState(null); const [pendingKey, setPendingKey] = useState('');
  const [prioritySavingId, setPrioritySavingId] = useState(null); const [priorityFeedback, setPriorityFeedback] = useState(null); const prioritySavingRef = useRef(false);
  const notify = text => { setToast(text); setTimeout(() => setToast(''), 2600); };
  const refresh = async () => {
    try {
      const [dashboard, selectedDay, activityData, analyticsData, insightData, goalData, account] = await Promise.all([api('/dashboard', { token }), api(`/days/${selected}`, { token }), api(`/activity?days=${range}`, { token }), api('/analytics', { token }), api('/insights', { token }), api('/goals', { token }), api('/me', { token })]);
      setData(dashboard); setDay(selectedDay); setActivity(activityData); setAnalytics(analyticsData); setInsights(insightData); setGoals(goalData); setMe(account); setRevision(x => x + 1); setFatal(''); notifications.load();
      const key = `hqSeen:${dashboard.user.name}`; const seen = JSON.parse(localStorage.getItem(key) || '[]'); const earned = dashboard.achievements.filter(x => x.unlocked_on).map(x => x.code); const fresh = dashboard.achievements.find(x => x.unlocked_on && !seen.includes(x.code));
      if (localStorage.getItem(key) && fresh) setCelebration(fresh);
      localStorage.setItem(key, JSON.stringify(earned));
    } catch (error) { if (error.status === 401) { localStorage.removeItem('hqToken'); setToken(''); } else setFatal(error.message); }
  };
  useEffect(() => { if (token) refresh(); }, [token, selected, range]);
  useEffect(() => {
    if (!data) return;
    const activeIds = data.habits.filter(habit => habit.active).map(habit => habit.id);
    setTrackedHabitIds(current => {
      const next = normalizeHabitSelection(current, activeIds);
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [data]);
  useEffect(() => { localStorage.setItem('hqTrackedHabitIds', JSON.stringify(trackedHabitIds)); }, [trackedHabitIds]);
  useEffect(() => {
    if (!token || !data) return undefined;
    if (!trackedHabitIds.length) { setHabitActivity({ days: range, habits: [] }); setHabitActivityLoading(false); return undefined; }
    let current = true; setHabitActivityLoading(true); setHabitActivityError('');
    api(`/habit-activity?days=${range}&habit_ids=${trackedHabitIds.join(',')}`, { token }).then(result => { if (current) setHabitActivity(result); }).catch(error => { if (current) setHabitActivityError(error.message); }).finally(() => { if (current) setHabitActivityLoading(false); });
    return () => { current = false; };
  }, [token, range, revision, trackedHabitIds.join(',')]);
  useEffect(() => { const change = () => setPage(location.hash.slice(1) || 'today'); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change); }, []);
  useEffect(() => {
    if (!token || page !== 'leaderboard') return undefined;
    let current = true; setLeaderboardBusy(true);
    api(`/leaderboard?period=${leaderboardPeriod}`, { token }).then(result => { if (current) setLeaderboard(result); }).catch(error => notify(error.message)).finally(() => { if (current) setLeaderboardBusy(false); });
    return () => { current = false; };
  }, [token, page, leaderboardPeriod, revision]);
  const navigate = target => { location.hash = target; setPage(target); };
  const selectDate = date => { setSelected(date); navigate('today'); };
  const openStat = metric => {
    const target = { today: 'daily-habits', streak: 'habit-tracking', weekly: 'weekly-trend', monthly: 'monthly-trend' }[metric];
    if (metric === 'today') { setSelected(todayIso()); navigate('today'); }
    else navigate('progress');
    setTimeout(() => { const section = document.getElementById(target); section?.scrollIntoView({ behavior: 'smooth', block: 'start' }); section?.focus({ preventScroll: true }); }, 80);
  };
  const toggle = async (habit, date) => {
    const key = `${habit.id}:${date}`;
    if (pendingKey) return;
    setPendingKey(key);
    try {
      const result = await api(`/habits/${habit.id}/complete`, { token, method: habit.done ? 'DELETE' : 'POST', body: { completed_on: date } });
      notify(habit.done ? 'Completion undone.' : result.xp_awarded ? `Saved for ${date} · +${result.xp_awarded} XP` : `Saved for ${date} · XP for this date was already claimed`);
      await refresh();
    } catch (error) { notify(error.message); } finally { setPendingKey(''); }
  };
  const saveProgress = async (habit, date, recordedValue) => {
    const key = `progress:${habit.id}:${date}`; if (pendingKey) return; setPendingKey(key);
    try { const result = await api(`/habits/${habit.id}/progress`, { token, method: 'PUT', body: { completed_on: date, recorded_value: recordedValue } }); notify(result.status === 'complete' ? `${habit.name} completed · ${recordedValue} ${habit.target_unit || ''}` : `${habit.name} progress saved · ${recordedValue}/${habit.daily_target}`); await refresh(); } catch (error) { notify(error.message); } finally { setPendingKey(''); }
  };
  const quickToggle = async habit => { try { await api(`/habits/${habit.id}/complete`, { token, method: habit.done_today ? 'DELETE' : 'POST', body: { completed_on: todayIso() } }); notify(habit.done_today ? 'Today’s completion undone.' : 'Today’s completion saved.'); await refresh(); } catch (error) { notify(error.message); } };
  const saveHabit = async form => { await api(modal?.id ? `/habits/${modal.id}` : '/habits', { token, method: modal?.id ? 'PUT' : 'POST', body: form }); notify(modal?.id ? 'Habit updated.' : 'Habit created.'); await refresh(); };
  const changePriority = async (habit, priority) => {
    if (prioritySavingRef.current || priority === (habit.priority || 'Medium')) return;
    prioritySavingRef.current = true; setPrioritySavingId(habit.id); setPriorityFeedback(null);
    try {
      const saved = await api(`/habits/${habit.id}/priority`, { token, method: 'PATCH', body: { priority } });
      setData(current => current ? { ...current, habits: current.habits.map(item => item.id === saved.id ? { ...item, priority: saved.priority } : item) } : current);
      setDay(current => current ? { ...current, habits: current.habits.map(item => item.id === saved.id ? { ...item, priority: saved.priority } : item) } : current);
      setPriorityFeedback({ type: 'success', text: `${habit.name} is now ${saved.priority} priority.` });
      notify(`${habit.name} priority saved.`);
    } catch (error) { setPriorityFeedback({ type: 'error', text: error.message }); notify(error.message); }
    finally { prioritySavingRef.current = false; setPrioritySavingId(null); }
  };
  const saveGoal = async (form, id) => { await api(id ? `/goals/${id}` : '/goals', { token, method: id ? 'PUT' : 'POST', body: form }); notify(id ? 'Challenge updated.' : 'Challenge created.'); await refresh(); };
  const goalAction = async (goal, action) => { try { await api(`/goals/${goal.id}/${action}`, { token, method: 'POST' }); notify(`Goal ${action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'completed'}.`); await refresh(); } catch (error) { notify(error.message); } };
  const deleteGoal = async goal => { if (confirm(`Delete goal “${goal.title}”? Your habits and check-ins will stay.`)) { try { await api(`/goals/${goal.id}`, { token, method: 'DELETE' }); notify('Goal deleted.'); await refresh(); } catch (error) { notify(error.message); } } };
  const archive = async habit => { if (confirm(`Archive “${habit.name}”? Its history will remain.`)) { try { await api(`/habits/${habit.id}/archive`, { token, method: 'POST' }); notify('Habit archived.'); await refresh(); } catch (error) { notify(error.message); } } };
  const restore = async habit => { try { await api(`/habits/${habit.id}/restore`, { token, method: 'POST' }); notify('Habit restored.'); await refresh(); } catch (error) { notify(error.message); } };
  const remove = async habit => { if (confirm(`Permanently delete “${habit.name}” and all its completion history?`)) { try { await api(`/habits/${habit.id}`, { token, method: 'DELETE' }); notify('Habit deleted.'); await refresh(); } catch (error) { notify(error.message); } } };
  const logout = async () => { try { await api('/auth/logout', { token, method: 'POST' }); } finally { localStorage.removeItem('hqToken'); setToken(''); setData(null); setMe(null); } };
  const demo = async reset => { if (reset && !confirm('Delete only the generated sample habits and history?')) return; try { const result = await api('/demo/sample', { token, method: reset ? 'DELETE' : 'POST' }); notify(reset ? 'Sample data removed.' : result.message); await refresh(); } catch (error) { notify(error.message); } };
  const setLeaderboardParticipation = async enabled => { setLeaderboardBusy(true); try { await api('/me/leaderboard', { token, method: 'PUT', body: { enabled } }); notify(enabled ? 'You joined the privacy-safe leaderboard.' : 'You left the leaderboard.'); await refresh(); const result = await api(`/leaderboard?period=${leaderboardPeriod}`, { token }); setLeaderboard(result); } catch (error) { notify(error.message); } finally { setLeaderboardBusy(false); } };
  if (!token) return <Auth onAuthenticated={setToken} inviteToken={inviteToken} />;
  if (fatal) return <div className="auth-screen"><div className="auth-card"><h2>{BRAND_NAME} could not load</h2><p>{fatal}</p><button className="primary" onClick={refresh}>Try again</button></div></div>;
  if (!data || !day || !activity || !analytics) return <div className="loading">Loading your real progress…</div>;
  const habitTracking = <HabitTracking habits={data.habits} activity={habitActivity} loading={habitActivityLoading} error={habitActivityError} selectedIds={trackedHabitIds} onSelection={setTrackedHabitIds} range={range} onRange={setRange} onSelect={selectDate} onAdd={() => setModal({})} />;
  const nav = [['today', 'home', 'Today'], ['habits', 'habits', 'My Habits'], ['calendar', 'calendar', 'Calendar'], ['progress', 'progress', 'Progress'], ['achievements', 'trophy', 'Achievements'], ['leaderboard', 'users', 'Leaderboard'], ['challenges', 'flag', 'Challenges'], ['settings', 'settings', 'Settings']];
  const pageTitle = page === 'today' ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${data.user.name}!` : page === 'habits' ? 'Your habit library.' : page === 'calendar' ? 'Your calendar.' : page === 'progress' ? 'Progress you actually made.' : page === 'achievements' ? 'Milestones, earned.' : page === 'leaderboard' ? 'A friendly race, by choice.' : page === 'challenges' ? 'Your challenges.' : `Make ${BRAND_NAME} yours.`;
  return <div className="app-shell"><aside className="sidebar"><Logo /><nav aria-label="Main navigation">{nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'nav active' : 'nav'} aria-current={page === id ? 'page' : undefined} aria-label={label} onClick={() => navigate(id)}><span><AppIcon name={icon} /></span>{label}</button>)}</nav><div className="sidebar-companion"><Owl /><b>Small habits<br />Big progress!</b></div><div className="profile"><div className="avatar">{data.user.name[0].toUpperCase()}</div><div className="profile-level"><b>{data.user.name}</b><small>Level {data.user.level} · {data.user.xp} XP</small><span><i style={{ width: `${data.user.level_progress}%` }} /></span><em>{data.user.xp_to_next_level} XP to Level {data.user.level + 1}</em></div></div><button className="support" onClick={logout}><AppIcon name="logout" /> Sign out</button></aside><main className="workspace"><header className="hq-header"><div className="header-greeting"><span className="weather-art" aria-hidden="true"><svg viewBox="0 0 60 60"><circle cx="28" cy="27" r="13" fill="#ffc751"/><path d="M9 45c2-9 14-13 21-6 9-9 22-2 21 8H9Z" fill="#9ed8f4"/><path d="M28 2v7M7 24l6 2M45 8l-5 5" stroke="#f5b92e" strokeWidth="3" strokeLinecap="round"/></svg></span><div><h1>{pageTitle}</h1><p>{page === 'today' ? 'Let’s make today count 🌿' : `Good to see you, ${data.user.name}.`}</p></div></div><div className="header-actions"><span className="header-date">▦ &nbsp; {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><label className="header-search"><span aria-hidden="true">⌕</span><input aria-label="Search habits" placeholder="Search habits..." value={query} onChange={e => { setQuery(e.target.value); navigate('habits'); }} onFocus={() => navigate('habits')} /></label><NotificationCenter state={notifications} navigate={navigate} /><button className="primary" onClick={() => setModal({})}>＋ Add Habit</button></div></header>
{page === 'today' && <DashboardHome data={data} activity={activity} habitActivity={habitActivity} habitActivityLoading={habitActivityLoading} habitActivityError={habitActivityError} trackedHabitIds={trackedHabitIds} setTrackedHabitIds={setTrackedHabitIds} token={token} selected={selected} setSelected={setSelected} day={day} revision={revision} toggle={toggle} saveProgress={saveProgress} pendingKey={pendingKey} openStat={openStat} range={range} setRange={setRange} selectDate={selectDate} navigate={navigate} onAdd={() => setModal({})} onEdit={h => setModal(data.habits.find(item => item.id === h.id))} onArchive={archive} onDelete={remove} onPriorityChange={changePriority} prioritySavingId={prioritySavingId} priorityFeedback={priorityFeedback} />}
    {page === 'calendar' && <div className="calendar-page"><Calendar token={token} selected={selected} onSelect={setSelected} day={day} revision={revision} onToggle={toggle} onProgress={saveProgress} pendingKey={pendingKey} />{habitTracking}</div>}
{page === 'habits' && <HabitsPage habits={data.habits} query={query} setQuery={setQuery} onEdit={setModal} onArchive={archive} onRestore={restore} onDelete={remove} onQuickComplete={quickToggle} onPriorityChange={changePriority} prioritySavingId={prioritySavingId} />}
    {page === 'progress' && <><Progress dashboard={data} activity={activity} analytics={analytics} insights={insights} range={range} setRange={setRange} onSelect={selectDate} onStatAction={openStat} />{habitTracking}</>}
    {page === 'achievements' && <Achievements items={data.achievements} />}
    {page === 'leaderboard' && <Leaderboard board={leaderboard} period={leaderboardPeriod} onPeriod={setLeaderboardPeriod} onParticipation={setLeaderboardParticipation} busy={leaderboardBusy} token={token} />}
    {page === 'challenges' && <Challenges dashboard={data} goals={goals} onAdd={() => setModal({})} onAddGoal={() => setGoalModal({})} onEditGoal={setGoalModal} onGoalAction={goalAction} onDeleteGoal={deleteGoal} />}
    {page === 'settings' && <Settings onDemo={() => demo(false)} onReset={() => demo(true)} message={toast} notifications={notifications} user={me} />}
  </main>{modal && <HabitForm habit={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveHabit} />}{goalModal && <GoalForm goal={goalModal.id ? goalModal : null} habits={data.habits} onClose={() => setGoalModal(null)} onSave={saveGoal} />}{toast && page !== 'settings' && <div className="toast">{toast}</div>}{celebration && <div className="celebration"><div><Spark streak={celebration.target || 1} completed /><p className="eyebrow">NEW MILESTONE</p><h2>{celebration.title}</h2><p>{celebration.description}</p><button className="primary" onClick={() => setCelebration(null)}>Keep going</button></div></div>}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
