import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const ICON = { drafts_ready: '🆕', demo_viewed: '👀', demo_engaged: '🔥', email_sent: '✉️' };

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const d = await api.listNotifications(); setItems(d.items || []); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function markRead(id) { await api.readNotification(id); load(); }
  async function markAll() { await api.readAllNotifications(); load(); }

  return (
    <div>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Notifications</h1>
        <button className="btn" onClick={markAll}>Mark all read</button>
      </div>

      {loading && <div className="muted">Loading…</div>}
      {!loading && items.length === 0 && <div className="card muted">No notifications yet.</div>}

      {items.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{ marginBottom: 8, opacity: n.read ? 0.6 : 1, borderLeft: n.read ? undefined : '4px solid var(--accent, #2563eb)' }}
        >
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <strong>{ICON[n.kind] || '🔔'} {n.title}</strong>
              {n.body && <div className="muted" style={{ marginTop: 4 }}>{n.body}</div>}
              <div className="mono muted" style={{ fontSize: 11, marginTop: 6 }}>{new Date(n.created_at + 'Z').toLocaleString()}</div>
            </div>
            <div className="row gap-sm">
              {n.link && <Link className="btn" to={n.link.replace(/^\/admin/, '')}>Open</Link>}
              {!n.read && <button className="btn" onClick={() => markRead(n.id)}>Mark read</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
