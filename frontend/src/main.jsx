import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './functional.css';
import './product.css';
import { monthColumns, padActivityCells } from './date-utils';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const todayIso = () => new Date().toISOString().slice(0, 10);

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'The request could not be completed.');
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
  return <div className={`hq-logo ${dark ? 'dark' : ''}`}><span>✦</span> habit<strong>quest</strong></div>;
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }

function HabitForm({ habit, onClose, onSave }) {
  const [form, setForm] = useState(habit ? { ...habit, start_date: habit.created_on } : {
    name: '', description: '', category: 'Personal', schedule: 'daily', icon: '✦', start_date: todayIso(), target_days: 30, target_text: '', reminder_time: '',
  });
  const [error, setError] = useState('');
  const save = async event => {
    event.preventDefault();
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
      <Field label="Schedule"><select value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}><option value="daily">Every day</option><option value="0,1,2,3,4">Weekdays</option><option value="0,1,2,3,4,5">Monday–Saturday</option><option value="0,2,4">Monday, Wednesday, Friday</option></select></Field>
      <Field label="Daily target"><input placeholder="e.g. Solve 2 questions" maxLength="120" value={form.target_text} onChange={e => setForm({ ...form, target_text: e.target.value })} /></Field>
    </div>
    {error && <p className="form-error">{error}</p>}<button className="primary">Save goal</button>
  </form></div>;
}

function Spark({ streak, completed, goalComplete = false }) {
  const state = goalComplete || streak >= 30 ? 'legend' : streak >= 7 ? 'party' : streak >= 3 ? 'charged' : completed ? 'happy' : 'idle';
  const messages = { idle: 'Ready for one small win?', happy: 'That counted. Nicely done!', charged: 'Your momentum is showing!', party: 'Seven days—what a rhythm!', legend: 'Goal complete. You made it real!' };
  return <section className={`spark-card ${state}`} aria-label={`Spark mascot: ${messages[state]}`}>
    <svg className="spark-svg" viewBox="0 0 140 140" role="img" aria-hidden="true">
      <path className="spark-tail" d="M35 91C10 87 15 60 38 67" />
      <path className="spark-body" d="M35 48C47 17 91 12 109 41C130 75 110 119 72 123C35 127 18 84 35 48Z" />
      <path className="spark-crest" d="M53 29L67 7L79 28L101 16L97 41" />
      <ellipse className="spark-eye" cx="57" cy="64" rx="7" ry="10" /><ellipse className="spark-eye" cx="91" cy="64" rx="7" ry="10" />
      <circle className="spark-glint" cx="59" cy="61" r="2" /><circle className="spark-glint" cx="93" cy="61" r="2" />
      <path className="spark-mouth" d={state === 'idle' ? 'M66 86Q74 90 82 86' : 'M61 84Q74 101 88 83'} />
      {state === 'legend' && <path className="spark-star" d="M116 20l4 9 10 1-8 7 2 10-8-5-9 5 2-10-7-7 10-1z" />}
    </svg>
    <div><p className="eyebrow">SPARK, YOUR QUEST COMPANION</p><h3>{messages[state]}</h3><p>Feedback follows your saved progress—not a page refresh.</p></div>
  </section>;
}

function Calendar({ token, selected, onSelect, day, revision, onToggle }) {
  const [cursor, setCursor] = useState(() => new Date(`${selected}T12:00:00`));
  const [month, setMonth] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/calendar/${cursor.getFullYear()}/${cursor.getMonth() + 1}`, { token }).then(setMonth).catch(err => setError(err.message));
  }, [token, cursor, revision]);
  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const today = todayIso();
  return <section className="calendar-panel panel">
    <div className="calendar-head"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button><h3>{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h3><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button></div>
    <button className="link-button compact" onClick={() => { setCursor(new Date()); onSelect(today); }}>Back to today</button>
    <div className="calendar-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <span key={i}>{x}</span>)}</div>
    <div className="calendar-grid">{Array.from({ length: firstWeekday }, (_, i) => <i key={`empty-${i}`} />)}{month?.days.map(cell => {
      const future = cell.date > today; const complete = cell.scheduled > 0 && cell.completed === cell.scheduled;
      return <button key={cell.date} disabled={future} onClick={() => onSelect(cell.date)} className={`${selected === cell.date ? 'selected ' : ''}${today === cell.date ? 'today ' : ''}${complete ? 'complete ' : cell.scheduled && !cell.completed ? 'missed ' : cell.completed ? 'partial ' : ''}`} title={`${cell.date}: ${cell.completed}/${cell.scheduled}`}>
        <b>{Number(cell.date.slice(-2))}</b>{cell.scheduled > 0 && <small>{cell.completed}/{cell.scheduled}</small>}{complete && <span className="mini-flame" />}
      </button>;
    })}</div>
    {error && <p className="form-error">{error}</p>}
    <div className="selected-day"><div><p className="eyebrow">SELECTED DATE</p><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div><b>{day?.completed || 0}/{day?.scheduled || 0}</b></div>
    <HabitChecklist habits={day?.habits || []} selected={selected} onToggle={onToggle} />
  </section>;
}

function HabitChecklist({ habits, selected, onToggle }) {
  if (!habits.length) return <div className="empty-state"><span>○</span><div><b>No habits scheduled</b><p>This is a rest day, not a missed day.</p></div></div>;
  return <div className="checklist">{habits.map(habit => <button key={habit.id} className={habit.done ? 'check-row done' : 'check-row'} onClick={() => onToggle(habit, selected)}>
    <span className="habit-symbol">{habit.icon || '✦'}</span><span><b>{habit.name}</b><small>{habit.description || habit.category}</small></span><i>{habit.done ? '✓' : ''}</i>
  </button>)}</div>;
}

function Heatmap({ activity, range, onRange, onSelect }) {
  const cells = activity?.cells || [];
  const padded = useMemo(() => padActivityCells(cells), [cells]);
  const months = useMemo(() => monthColumns(cells), [cells]);
  const hasHistory = cells.some(cell => cell.completed > 0);
  return <section className="heat-panel panel"><div className="panel-title"><div><p className="eyebrow">CONTRIBUTION MAP</p><h2>Consistency over time</h2></div><select value={range} onChange={e => onRange(Number(e.target.value))}><option value="70">10 weeks</option><option value="183">6 months</option><option value="365">1 year</option></select></div>
    {hasHistory ? <><div className="month-labels">{months.map(x => <span key={x.key} style={{ gridColumn: x.column }}>{x.label}</span>)}</div><div className="heat-grid">{padded.map((cell, index) => cell ? <button key={cell.date} className={`level-${cell.intensity}`} title={`${cell.date}: ${cell.completed} completed of ${cell.scheduled} scheduled`} onClick={() => onSelect(cell.date)} /> : <i key={`pad-${index}`} />)}</div><div className="heat-footer"><div><b>{activity.stats.completed}</b> check-ins · <b>{activity.stats.active_days}</b> active days · <b>{activity.stats.longest_habit_streak}</b> best streak</div><div className="legend"><span>Less</span>{[0, 1, 2, 3, 4].map(x => <i className={`level-${x}`} key={x} />)}<span>More</span></div></div></> : <div className="empty-state roomy"><span>✦</span><div><b>Your map starts with one check-in</b><p>Complete a scheduled habit and its real date will appear here.</p></div></div>}
  </section>;
}

function Achievements({ items, compact = false }) {
  const earned = items.filter(x => x.unlocked_on); const locked = items.filter(x => !x.unlocked_on);
  if (compact) return <section className="milestones panel"><div className="panel-title"><div><p className="eyebrow">ACHIEVEMENTS & MILESTONES</p><h2>Latest earned</h2></div></div>{earned.length ? <div className="badge-grid compact">{earned.slice(-3).reverse().map(x => <Badge key={x.code} item={x} />)}</div> : <div className="empty-state"><span>◇</span><div><b>Your first badge is close</b><p>Complete one habit to unlock First Step.</p></div></div>}</section>;
  return <div className="achievements-page"><p className="eyebrow">EARNED</p>{earned.length ? <div className="badge-grid">{earned.map(x => <Badge key={x.code} item={x} />)}</div> : <div className="empty-state roomy"><span>◇</span><div><b>No badges yet</b><p>Complete your first scheduled habit to begin.</p></div></div>}<p className="eyebrow locked-title">LOCKED · KEEP GOING</p><div className="badge-grid">{locked.map(x => <Badge key={x.code} item={x} />)}</div></div>;
}
function Badge({ item }) { return <article className={item.unlocked_on ? 'badge-card earned' : 'badge-card locked'}><span>{item.unlocked_on ? '✦' : '◇'}</span><div><h3>{item.title}</h3><p>{item.description}</p><small>{item.unlocked_on ? `Earned ${item.unlocked_on}` : `${Math.min(item.progress, item.target)} / ${item.target}`}</small></div></article>; }

function Progress({ activity, range, setRange, habits, onSelect }) {
  const weeks = [];
  activity?.cells.forEach((cell, index) => { const bucket = Math.floor(index / 7); weeks[bucket] = (weeks[bucket] || 0) + cell.completed; });
  const max = Math.max(1, ...weeks);
  return <div className="progress-page"><div className="metric-grid"><Metric label="Check-ins" value={activity?.stats.completed || 0} /><Metric label="Active days" value={activity?.stats.active_days || 0} /><Metric label="Current streak" value={`${activity?.stats.current_streak || 0}d`} /><Metric label="Longest habit streak" value={`${activity?.stats.longest_habit_streak || 0}d`} /></div><Heatmap activity={activity} range={range} onRange={setRange} onSelect={onSelect} /><section className="panel chart-panel"><div className="panel-title"><div><p className="eyebrow">WEEKLY CHECK-INS</p><h2>Actual completions</h2></div></div>{weeks.some(Boolean) ? <div className="bar-chart">{weeks.map((value, i) => <div key={i}><i style={{ height: `${Math.max(4, value / max * 100)}%` }} title={`${value} check-ins`} /><small>W{i + 1}</small></div>)}</div> : <p className="empty-state">No completion data in this period.</p>}</section><section className="panel goal-table"><div className="panel-title"><div><p className="eyebrow">GOAL PROGRESS</p><h2>Configured targets</h2></div></div>{habits.filter(x => x.target_days).map(h => <div className="goal-row" key={h.id}><span>{h.icon}</span><div><b>{h.name}</b><small>{h.completed_days}/{h.target_days} days · ends {h.target_end}</small><i><em style={{ width: `${h.goal_progress}%` }} /></i></div><strong>{h.goal_progress}%</strong></div>)}</section></div>;
}
function Metric({ label, value }) { return <article className="metric"><p>{label}</p><b>{value}</b></article>; }

function HabitsPage({ habits, query, setQuery, onAdd, onEdit, onArchive, onDelete }) {
  const shown = habits.filter(h => h.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel habits-page"><div className="toolbar"><input id="habit-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your goals" /><button className="primary" onClick={onAdd}>+ New goal</button></div>{shown.length ? <div className="habit-library">{shown.map(h => <article key={h.id} className={!h.active ? 'archived' : ''}><span className="library-icon">{h.icon}</span><div className="library-main"><div><h3>{h.name} {h.is_demo && <small>DEMO</small>}</h3><p>{h.description || h.category}</p></div><div className="goal-meta"><span>{h.current} current</span><span>{h.longest} longest</span><span>{h.completed_days}/{h.target_days || '∞'} days</span></div>{h.target_days > 0 && <div className="goal-bar"><i style={{ width: `${h.goal_progress}%` }} /></div>}</div><div className="row-actions"><button onClick={() => onEdit(h)}>Edit</button>{h.active && <button onClick={() => onArchive(h)}>Archive</button>}<button className="danger" onClick={() => onDelete(h)}>Delete</button></div></article>)}</div> : <div className="empty-state roomy"><span>⌕</span><div><b>No matching goals</b><p>Try another search or create a new goal.</p></div></div>}</section>;
}

function Settings({ onDemo, onReset, message }) { return <section className="settings panel"><p className="eyebrow">HELP & SETTINGS</p><h2>Rules you can explain in your demo</h2><div className="rules"><p><b>Completion:</b> one unique user-owned habit and calendar date. It earns 20 XP once.</p><p><b>Undo:</b> removes only that date's record and reverses its completion XP.</p><p><b>Streak:</b> consecutive scheduled dates; rest days are skipped and future dates are ignored.</p><p><b>Level:</b> every 100 XP advances one level.</p><p><b>Archive:</b> preserves history while removing a goal from future schedules.</p></div><div className="demo-box"><h3>Demo Mode</h3><p>Generate clearly labelled habits and real completion records across four weeks, including genuine missed and completed days. Values are calculated by production logic and persist after refresh.</p><button className="primary" onClick={onDemo}>Load sample history</button><button className="link-button danger-text" onClick={onReset}>Reset sample data only</button>{message && <p className="form-note">{message}</p>}</div></section>; }

function App() {
  const [token, setToken] = useState(localStorage.getItem('hqToken') || '');
  const [page, setPage] = useState(location.hash.slice(1) || 'today');
  const [data, setData] = useState(null); const [day, setDay] = useState(null); const [activity, setActivity] = useState(null);
  const [selected, setSelected] = useState(todayIso()); const [range, setRange] = useState(70); const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null); const [query, setQuery] = useState(''); const [toast, setToast] = useState(''); const [fatal, setFatal] = useState(''); const [celebration, setCelebration] = useState(null);
  const notify = text => { setToast(text); setTimeout(() => setToast(''), 2600); };
  const refresh = async () => {
    try {
      const [dashboard, selectedDay, activityData] = await Promise.all([api('/dashboard', { token }), api(`/days/${selected}`, { token }), api(`/activity?days=${range}`, { token })]);
      setData(dashboard); setDay(selectedDay); setActivity(activityData); setRevision(x => x + 1); setFatal('');
      const key = `hqSeen:${dashboard.user.name}`; const seen = JSON.parse(localStorage.getItem(key) || '[]'); const earned = dashboard.achievements.filter(x => x.unlocked_on).map(x => x.code); const fresh = dashboard.achievements.find(x => x.unlocked_on && !seen.includes(x.code));
      if (localStorage.getItem(key) && fresh) setCelebration(fresh);
      localStorage.setItem(key, JSON.stringify(earned));
    } catch (error) { if (error.message.includes('sign in')) { localStorage.removeItem('hqToken'); setToken(''); } else setFatal(error.message); }
  };
  useEffect(() => { if (token) refresh(); }, [token, selected, range]);
  useEffect(() => { const change = () => setPage(location.hash.slice(1) || 'today'); addEventListener('hashchange', change); return () => removeEventListener('hashchange', change); }, []);
  const navigate = target => { location.hash = target; setPage(target); };
  const selectDate = date => { setSelected(date); navigate('today'); };
  const toggle = async (habit, date) => { try { const result = await api(`/habits/${habit.id}/complete`, { token, method: habit.done ? 'DELETE' : 'POST', body: { completed_on: date } }); notify(habit.done ? 'Completion undone.' : `Saved for ${date} · +${result.xp_awarded || 20} XP`); await refresh(); } catch (error) { notify(error.message); } };
  const saveHabit = async form => { await api(modal?.id ? `/habits/${modal.id}` : '/habits', { token, method: modal?.id ? 'PUT' : 'POST', body: form }); notify(modal?.id ? 'Goal updated.' : 'Goal created.'); await refresh(); };
  const archive = async habit => { if (confirm(`Archive “${habit.name}”? Its history will remain.`)) { await api(`/habits/${habit.id}/archive`, { token, method: 'POST' }); notify('Goal archived.'); refresh(); } };
  const remove = async habit => { if (confirm(`Permanently delete “${habit.name}” and its history?`)) { await api(`/habits/${habit.id}`, { token, method: 'DELETE' }); notify('Goal deleted.'); refresh(); } };
  const logout = async () => { try { await api('/auth/logout', { token, method: 'POST' }); } finally { localStorage.removeItem('hqToken'); setToken(''); setData(null); } };
  const demo = async reset => { if (reset && !confirm('Delete only the generated sample habits and history?')) return; try { const result = await api('/demo/sample', { token, method: reset ? 'DELETE' : 'POST' }); notify(reset ? 'Sample data removed.' : result.message); await refresh(); } catch (error) { notify(error.message); } };
  if (!token) return <Auth onAuthenticated={setToken} />;
  if (fatal) return <div className="auth-screen"><div className="auth-card"><h2>HabitQuest could not load</h2><p>{fatal}</p><button className="primary" onClick={refresh}>Try again</button></div></div>;
  if (!data || !day || !activity) return <div className="loading">Loading your real progress…</div>;
  const nav = [['today', '⌂', 'Today'], ['habits', '◎', 'My habits'], ['progress', '⌁', 'Progress'], ['achievements', '✦', 'Achievements'], ['settings', '?', 'Help & settings']];
  const todayDone = data.today.completed > 0;
  return <div className="app-shell"><aside className="sidebar"><Logo /><div className="profile"><div className="avatar">{data.user.name[0].toUpperCase()}</div><div><b>{data.user.name}</b><small>Level {data.user.level} · {data.user.xp} XP</small></div></div><nav>{nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'nav active' : 'nav'} onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}</nav><button className="support" onClick={logout}>↪ &nbsp; Sign out</button></aside><main className="workspace"><header><div><p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</p><h1>{page === 'today' ? `Good ${new Date().getHours() < 12 ? 'morning' : 'evening'}, ${data.user.name}.` : page === 'habits' ? 'Your goal library.' : page === 'progress' ? 'Progress you actually made.' : page === 'achievements' ? 'Milestones, earned.' : 'Make HabitQuest yours.'}</h1></div><div className="header-actions"><button className="icon-button" aria-label="Search" onClick={() => { navigate('habits'); setTimeout(() => document.querySelector('#habit-search')?.focus(), 50); }}>⌕</button><button className="primary" onClick={() => setModal({})}>+ Add goal</button></div></header>
    {page === 'today' && <><div className="metric-grid"><Metric label="Overall streak" value={`${data.overall_streak}d`} /><Metric label="Today's progress" value={`${data.today.completed}/${data.today.total}`} /><Metric label="Level & XP" value={`L${data.user.level} · ${data.user.xp}`} /><Metric label="Active this week" value={`${data.weekly_challenge.active_days}/5d`} /></div><div className="today-layout"><Calendar token={token} selected={selected} onSelect={setSelected} day={day} revision={revision} onToggle={toggle} /><div className="today-side"><Spark streak={data.overall_streak} completed={todayDone} goalComplete={data.habits.some(x => x.goal_complete)} /><section className="quest panel"><p className="eyebrow">DAILY QUEST</p><h3>{data.today.total ? 'Complete today’s scheduled habits' : 'Enjoy your planned rest day'}</h3><p>{data.today.completed}/{data.today.total} complete {data.today.bonus_claimed && '· bonus earned'}</p><div className="goal-bar"><i style={{ width: `${data.today.total ? data.today.completed / data.today.total * 100 : 0}%` }} /></div><p className="eyebrow week-label">WEEKLY CHALLENGE · {data.weekly_challenge.active_days}/5 ACTIVE DAYS</p></section></div></div><Heatmap activity={activity} range={range} onRange={setRange} onSelect={selectDate} /><Achievements items={data.achievements} compact /></>}
    {page === 'habits' && <HabitsPage habits={data.habits} query={query} setQuery={setQuery} onAdd={() => setModal({})} onEdit={setModal} onArchive={archive} onDelete={remove} />}
    {page === 'progress' && <Progress activity={activity} range={range} setRange={setRange} habits={data.habits} onSelect={selectDate} />}
    {page === 'achievements' && <Achievements items={data.achievements} />}
    {page === 'settings' && <Settings onDemo={() => demo(false)} onReset={() => demo(true)} message={toast} />}
  </main>{modal && <HabitForm habit={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveHabit} />}{toast && page !== 'settings' && <div className="toast">{toast}</div>}{celebration && <div className="celebration"><div><Spark streak={celebration.target || 1} completed /><p className="eyebrow">NEW MILESTONE</p><h2>{celebration.title}</h2><p>{celebration.description}</p><button className="primary" onClick={() => setCelebration(null)}>Keep going</button></div></div>}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
