import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUSES = ['draft', 'approved', 'sent', 'failed', 'rejected', 'all'];
const STATUS_LABEL = { draft: 'Pending review', approved: 'Approved', sent: 'Sent', failed: 'Failed', rejected: 'Rejected', all: 'All' };

export default function Outreach() {
  const [status, setStatus] = useState('draft');
  const [data, setData] = useState({ items: [], counts: {}, emailConfigured: true });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.listOutreach(status === 'all' ? undefined : status);
      setData(d);
      if (!d.items.find((i) => i.id === selectedId)) setSelectedId(d.items[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [status]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container">
      <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Review queue</h1>
      </div>

      {!data.emailConfigured && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #b45309' }}>
          ⚠ No <span className="mono">RESEND_API_KEY</span> set on the server — approving will mark items sent but no email actually goes out. Add it to send for real.
        </div>
      )}

      <div className="row gap-sm" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`btn ${status === s ? 'primary' : ''}`}
            onClick={() => setStatus(s)}
          >
            {STATUS_LABEL[s]}{typeof data.counts[s] === 'number' ? ` (${data.counts[s]})` : ''}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 280px' }}>
          {loading && <div className="card muted">Loading…</div>}
          {!loading && data.items.length === 0 && <div className="card muted">Nothing here.</div>}
          {data.items.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className="card"
              style={{
                display: 'block', width: '100%', textAlign: 'left', marginBottom: 8, cursor: 'pointer',
                border: o.id === selectedId ? '2px solid var(--accent, #2563eb)' : undefined,
              }}
            >
              <div className="row between">
                <strong>{o.business}</strong>
                <StatusPill status={o.status} />
              </div>
              <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{o.email_to}</div>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedId
            ? <Detail id={selectedId} onChanged={load} />
            : <div className="card muted">Select an item to review.</div>}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const color = { draft: '#b45309', approved: '#2563eb', sent: '#15803d', failed: '#b91c1c', rejected: '#6b7280' }[status] || '#6b7280';
  return <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{status}</span>;
}

function Detail({ id, onChanged }) {
  const [o, setO] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getOutreach(id).then((d) => {
      if (cancelled) return;
      setO(d); setSubject(d.email_subject); setBody(d.email_body); setDirty(false); setErr('');
    });
    return () => { cancelled = true; };
  }, [id]);

  if (!o) return <div className="card muted">Loading…</div>;

  const isDraft = o.status === 'draft' || o.status === 'failed';
  const isApproved = o.status === 'approved';
  const canEdit = isDraft || isApproved;   // editable until the email actually goes out

  async function save() {
    setBusy('save'); setErr('');
    try { await api.updateOutreach(id, { email_subject: subject, email_body: body }); setDirty(false); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function approve() {
    if (dirty) await save();
    if (!confirm('Publish this demo live? No email is sent yet — you send that in the next step.')) return;
    setBusy('approve'); setErr('');
    try { await api.approveOutreach(id); await onChanged(); const d = await api.getOutreach(id); setO(d); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function send() {
    if (dirty) await save();
    if (!confirm(`Send this email to ${o.email_to}?`)) return;
    setBusy('send'); setErr('');
    try { await api.sendOutreach(id); await onChanged(); const d = await api.getOutreach(id); setO(d); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }
  async function reject() {
    if (!confirm('Reject this draft? The demo stays offline.')) return;
    setBusy('reject');
    try { await api.rejectOutreach(id); await onChanged(); const d = await api.getOutreach(id); setO(d); }
    catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }

  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{o.business}</h2>
        <StatusPill status={o.status} />
      </div>

      {err && <div className="card" style={{ borderLeft: '4px solid #b91c1c', margin: '12px 0' }}>{err}</div>}
      {o.status === 'failed' && o.error && (
        <div className="muted" style={{ color: '#b91c1c', marginTop: 8 }}>Last send error: {o.error}</div>
      )}

      <div className="row gap-sm" style={{ margin: '12px 0', flexWrap: 'wrap' }}>
        {o.tenant && (
          <a className="btn" href={o.tenant.url} target="_blank" rel="noreferrer">
            🔍 Preview demo{o.tenant.enabled ? '' : ' (not live)'}
          </a>
        )}
        {o.tenant && <Link className="btn" to={`/tenants/${o.tenant.id}`}>✎ Edit site content</Link>}
      </div>

      <div className="field">
        <label>Email to</label>
        <input className="input mono" value={o.email_to} readOnly />
      </div>
      <div className="field">
        <label>Subject</label>
        <input
          className="input"
          value={subject}
          disabled={!canEdit}
          onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
        />
      </div>
      <div className="field">
        <label>Body</label>
        <textarea
          className="textarea"
          style={{ minHeight: 240 }}
          value={body}
          disabled={!canEdit}
          onChange={(e) => { setBody(e.target.value); setDirty(true); }}
        />
        <div className="muted" style={{ fontSize: 12 }}>Plain text. The demo link is included above in the body; keep it in.</div>
      </div>

      {canEdit && (
        <div className="row gap-sm" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!dirty || busy} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
          <button className="btn primary" disabled={busy || !isDraft} onClick={approve}>
            {busy === 'approve' ? 'Approving…' : isApproved ? '✓ Approved' : '✓ Approve demo'}
          </button>
          <button className="btn primary" disabled={busy || !isApproved} onClick={send}>{busy === 'send' ? 'Sending…' : '✉ Send email'}</button>
          <button className="btn danger" disabled={busy} onClick={reject}>Reject</button>
        </div>
      )}
      {isApproved && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Demo is live. Review the email above, then click <strong>Send email</strong> to reach out.
        </div>
      )}
      {o.status === 'sent' && (
        <div className="muted" style={{ marginTop: 12 }}>
          ✓ Sent{o.sent_at ? ` ${new Date(o.sent_at).toLocaleString()}` : ''} · {o.view_count} demo view{o.view_count === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}
