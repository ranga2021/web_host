import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const STATUSES = ['new', 'dismissed', 'all'];
const STATUS_LABEL = { new: 'To review', dismissed: 'Dismissed', all: 'All' };

const blankLead = { business: '', website: '', email: '', phone: '', category: '', region: '' };

export default function Leads() {
  const [status, setStatus] = useState('new');
  const [data, setData] = useState({ items: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.listLeads(status === 'all' ? undefined : status);
      setData(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Collected leads</h1>
        <button className="btn primary" onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : '+ Add lead'}</button>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Businesses the bot gathered from Yellow Pages / Google Places. Review them, add a contact email, then
        they're ready for the generator to draft a demo.
      </p>

      {err && <div className="error">{err}</div>}

      {adding && <AddLead onDone={() => { setAdding(false); load(); }} onError={setErr} />}

      <div className="row gap-sm" style={{ margin: '16px 0', flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button key={s} className={`btn ${status === s ? 'primary' : ''}`} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}{typeof data.counts[s] === 'number' ? ` (${data.counts[s]})` : ''}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : data.items.length === 0 ? (
          <div className="empty">
            No leads here yet. Run the collector — <span className="mono">npm run collect -- --term="…" --location="…"</span> — or add one manually.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact email</th>
                <th>Website</th>
                <th>Phone</th>
                <th>Category</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => <LeadRow key={l.id} lead={l} onChanged={load} onError={setErr} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LeadRow({ lead, onChanged, onError }) {
  const [email, setEmail] = useState(lead.email || '');
  const [busy, setBusy] = useState('');
  const dirty = (email || '') !== (lead.email || '');

  async function act(kind, fn) {
    setBusy(kind);
    try { await fn(); await onChanged(); }
    catch (e) { onError(e.message); }
    finally { setBusy(''); }
  }

  return (
    <tr style={lead.status === 'dismissed' ? { opacity: 0.55 } : undefined}>
      <td>
        <div style={{ fontWeight: 600 }}>{lead.business}</div>
        {lead.region && <div className="muted" style={{ fontSize: 11.5 }}>{lead.region}</div>}
      </td>
      <td>
        <div className="row gap-sm" style={{ gap: 6 }}>
          <input
            className="input"
            style={{ minWidth: 180, padding: '6px 9px' }}
            type="email"
            placeholder="add email…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {dirty && (
            <button className="btn" disabled={busy} onClick={() => act('save', () => api.updateLead(lead.id, { email }))}>
              {busy === 'save' ? '…' : 'Save'}
            </button>
          )}
        </div>
      </td>
      <td>
        {lead.website
          ? <a href={lead.website} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12 }}>{shortUrl(lead.website)}</a>
          : <span className="muted">— no site —</span>}
      </td>
      <td className="mono" style={{ fontSize: 12 }}>{lead.phone || <span className="muted">—</span>}</td>
      <td className="muted" style={{ fontSize: 12 }}>{lead.category || '—'}</td>
      <td><span className="badge">{lead.source || 'manual'}</span></td>
      <td className="actions">
        {lead.status === 'dismissed' ? (
          <button className="btn" disabled={busy} onClick={() => act('restore', () => api.restoreLead(lead.id))}>Restore</button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => act('dismiss', () => api.dismissLead(lead.id))}>Dismiss</button>
        )}{' '}
        <button
          className="btn danger"
          disabled={busy}
          onClick={() => { if (confirm(`Delete "${lead.business}"?`)) act('del', () => api.deleteLead(lead.id)); }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function AddLead({ onDone, onError }) {
  const [form, setForm] = useState(blankLead);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.business.trim()) return;
    setBusy(true);
    try { await api.addLead(form); setForm(blankLead); onDone(); }
    catch (err) { onError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 8 }}>
      <div className="finder-grid" style={{ marginBottom: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Business name *</label>
          <input className="input" value={form.business} onChange={set('business')} placeholder="Acme Glass Co" required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Contact email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="hello@acme.com" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Website</label>
          <input className="input" value={form.website} onChange={set('website')} placeholder="https://acme.com" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Phone</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="(02) 5555 0100" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Category</label>
          <input className="input" value={form.category} onChange={set('category')} placeholder="Glazier" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Region</label>
          <input className="input" value={form.region} onChange={set('region')} placeholder="Sydney NSW" />
        </div>
      </div>
      <button className="btn primary" disabled={busy || !form.business.trim()}>{busy ? 'Adding…' : 'Add lead'}</button>
    </form>
  );
}

function shortUrl(u) {
  return String(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}
