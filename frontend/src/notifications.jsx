import React, { useEffect, useState } from 'react';
import { emailConfigError, sendNotificationEmail } from './emailjs-client';

const LABELS = { pending: 'Habit reminder', missed: 'Fresh start', streak_at_risk: 'Streak reminder', achievement: 'Achievement', test: 'Test email' };
const DEMOS = ['pending', 'missed', 'streak_at_risk', 'achievement'];
const timestamp = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function useNotifications(api, token, user) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [preferences, setPreferences] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, prefs] = await Promise.all([api('/notifications', { token }), api('/notification-preferences', { token })]);
      setItems(list.items); setUnread(list.unread_count); setPreferences(prefs); setError('');
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };
  const send = async notification => {
    setBusy(true);
    try {
      const configError = emailConfigError();
      if (configError) throw new Error(configError);
      if (!user?.email) throw new Error('Your account has no registered email address. Sign in with an account that has an email address.');
      await api(`/notifications/${notification.id}/email-claim`, { token, method: 'POST' });
      try { await sendNotificationEmail(notification, user); }
      catch (cause) {
        await api(`/notifications/${notification.id}/email-outcome`, { token, method: 'POST', body: { status: 'failed' } }).catch(() => {});
        throw cause;
      }
      await api(`/notifications/${notification.id}/email-outcome`, { token, method: 'POST', body: { status: 'accepted' } });
      setMessage('EmailJS accepted the email request. Check your inbox and spam folder.');
      await load();
    } finally { setBusy(false); }
  };
  const action = async (path, method = 'POST', body) => {
    setBusy(true); setMessage('');
    try { const result = await api(path, { token, method, body }); await load(); return result; }
    catch (cause) { setMessage(cause.message); throw cause; }
    finally { setBusy(false); }
  };
  const sendTest = async () => {
    setBusy(true); setMessage('');
    try {
      if (emailConfigError()) throw new Error(emailConfigError());
      if (!user?.email) throw new Error('Your account has no registered email address. Sign in with an account that has an email address.');
      const notification = await api('/notifications/test', { token, method: 'POST' });
      await send(notification);
    } catch (cause) { setMessage(cause.message); }
    finally { await load(); setBusy(false); }
  };
  useEffect(() => {
    if (!token) { setItems([]); setUnread(0); setPreferences(null); return undefined; }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [token]);
  useEffect(() => {
    if (!token || !user || emailConfigError()) return undefined;
    let cancelled = false;
    const flush = async () => {
      try {
        const result = await api('/notifications/due', { token });
        for (const notification of result.items) {
          if (cancelled) break;
          await send(notification).catch(cause => setMessage(cause.message));
        }
      } catch (cause) { if (!cancelled) setError(cause.message); }
    };
    flush();
    const interval = setInterval(flush, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, user?.email]);
  return { items, unread, preferences, error, loading, busy, message, setMessage, load, action, send, sendTest };
}

export function NotificationCenter({ state, navigate }) {
  const [open, setOpen] = useState(false);
  const visit = async item => {
    if (!item.read) await state.action(`/notifications/${item.id}/read`).catch(() => {});
    navigate(item.kind === 'achievement' ? 'achievements' : item.habit_id ? 'habits' : 'today');
    setOpen(false);
  };
  return <div className="notification-anchor"><button className="notification-bell" aria-label={`Notifications, ${state.unread} unread`} aria-expanded={open} onClick={() => { setOpen(value => !value); state.load(); }} title="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{state.unread > 0 && <span>{state.unread > 99 ? '99+' : state.unread}</span>}</button>
    {open && <section className="notification-popover" aria-label="Notification center"><header><div><b>Notifications</b><small>Little wins and friendly reminders</small></div><button aria-label="Close notifications" onClick={() => setOpen(false)}>×</button></header>
      {state.message && <p className="notification-state email-result" role="status">{state.message}</p>}
      {state.loading && <p className="notification-state">Loading notifications…</p>}
      {state.error && <p className="notification-state error" role="alert">{state.error}<button onClick={state.load}>Try again</button></p>}
      {!state.loading && !state.error && !state.items.length && <p className="notification-state">All caught up. Your next little win is waiting!</p>}
      <div className="notification-list">{state.items.map(item => <article key={item.id} className={item.read ? 'read' : 'unread'}><div className="notification-item-head"><span>{LABELS[item.kind] || item.kind}{item.is_demo ? ' · Demo' : ''}</span><time dateTime={item.created_at}>{timestamp(item.created_at)}</time></div><button className="notification-content" onClick={() => visit(item)}><b>{item.title}</b><small>{item.message}</small></button><div className="notification-row-actions"><span>Email: {item.email_status === 'accepted' ? 'accepted by EmailJS' : item.is_demo && item.email_status === 'pending' ? 'not requested' : item.email_status}</span>{!item.read && <button onClick={() => state.action(`/notifications/${item.id}/read`).catch(() => {})}>Mark read</button>}<button onClick={() => state.action(`/notifications/${item.id}/dismiss`).catch(() => {})}>Dismiss</button></div></article>)}</div>
    </section>}</div>;
}

export function EmailNotificationSettings({ state, user }) {
  const update = async (key, value) => {
    if (!state.preferences) return;
    try { await state.action('/notification-preferences', 'PUT', { ...state.preferences, [key]: value }); state.setMessage('Email preferences saved.'); }
    catch { /* action displays the error */ }
  };
  const preview = async kind => {
    try { await state.action('/notifications/demo', 'POST', { kind }); state.setMessage(`${LABELS[kind]} preview added to the notification bell.`); }
    catch { /* action displays the error */ }
  };
  const sendDemo = async kind => {
    if (emailConfigError()) { state.setMessage(emailConfigError()); return; }
    if (!user?.email) { state.setMessage('Your account has no registered email address.'); return; }
    try { const item = await state.action('/notifications/demo', 'POST', { kind }); await state.send(item); }
    catch (cause) { state.setMessage(cause.message); }
  };
  return <div className="email-settings"><section className="email-settings-card"><p className="eyebrow">EMAIL NOTIFICATIONS</p><h2>Friendly nudges, your way</h2><p>Email goes to your registered address: <strong>{user?.email || 'Unavailable'}</strong></p><p className={emailConfigError() ? 'email-config missing' : 'email-config'}>{emailConfigError() || 'EmailJS settings are present. Use Send Test Email to verify the connection.'}</p>
      {state.loading && !state.preferences ? <p>Loading preferences…</p> : state.preferences && <div className="email-toggle-list">{[['email_enabled','Send me emails'],['pending','Pending habit reminders'],['missed','Missed habit notes'],['streak_at_risk','Streak at risk'],['achievement','Achievements and level ups']].map(([key,label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={state.preferences[key]} disabled={state.busy} onChange={event => update(key,event.target.checked)} /></label>)}</div>}
      <button className="primary" disabled={state.busy || Boolean(emailConfigError()) || !user?.email} onClick={state.sendTest}>{state.busy ? 'Working…' : 'Send Test Email'}</button>{state.message && <p className="email-test-result" role="status">{state.message}</p>}<p className="email-help">Test email sends to your registered address even if routine reminders are off. EmailJS acceptance does not guarantee inbox delivery.</p>
    </section><section className="email-settings-card demo-notifications"><p className="eyebrow">DEMO NOTIFICATIONS</p><h2>Preview each moment</h2><p>These examples appear only in your notification center. They never change habits, XP, streaks, or achievements.</p><div className="demo-notification-actions">{DEMOS.map(kind => <div key={kind}><button disabled={state.busy} onClick={() => preview(kind)}>Preview {LABELS[kind]}</button><button disabled={state.busy || Boolean(emailConfigError()) || !user?.email} onClick={() => sendDemo(kind)}>Email me this example</button></div>)}</div><div className="demo-notification-footer"><button disabled={state.busy} onClick={() => state.action('/notifications/demo', 'DELETE').then(() => state.setMessage('Demo notifications cleared.')).catch(() => {})}>Clear demo notifications</button><button disabled={state.busy} onClick={() => { state.load(); document.querySelector('.notification-bell')?.click(); }}>View notification center</button></div>
    </section></div>;
}
