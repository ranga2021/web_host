import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const STATUSES = ['new', 'dismissed', 'all'];
const STATUS_LABEL = { new: 'To review', dismissed: 'Dismissed', all: 'All' };

const blankLead = { business: '', website: '', email: '', phone: '', category: '', region: '' };
const CATEGORY_PRESETS = ['Restaurants', 'Dentists', 'Gyms', 'Law firms', 'Real estate agents', 'Plumbers', 'Cafes', 'Salons'];

export default function Leads() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('new');
  const [data, setData] = useState({ items: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [claudeOn, setClaudeOn] = useState(false);
  const [genMsg, setGenMsg] = useState(null);
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

  // Load the templates available to generate demos from (once).
  useEffect(() => {
    api.leadGenerateOptions()
      .then((o) => {
        setTemplates(o.templates || []);
        setClaudeOn(!!o.claudeConfigured);
        setTemplateId((prev) => prev || (o.templates?.[0]?.id ? String(o.templates[0].id) : ''));
      })
      .catch(() => {});
  }, []);

  const generateDemo = useCallback(async (lead) => {
    if (!templateId) { setErr('Pick a template to generate from first.'); return; }
    setErr(''); setGenMsg(null);
    const r = await api.generateDemo(lead.id, Number(templateId));
    setGenMsg({
      business: lead.business,
      url: r.demo_url,
      usedClaude: r.usedClaude,
      template: r.template?.name,
    });
    await load();
    return r;
  }, [templateId, load]);

  // Mark the lead reviewed and hand it off to the New Tenant form, prefilled with
  // the business name and the currently selected template.
  const createTenant = useCallback((lead) => {
    const params = new URLSearchParams();
    if (lead.business) params.set('name', lead.business);
    if (templateId) params.set('template', String(templateId));
    navigate(`/tenants/new?${params.toString()}`);
  }, [navigate, templateId]);

  async function importSheet() {
    setImporting(true); setImportResult(null); setErr('');
    try {
      const r = await api.importSheet();
      setImportResult(r);
      if (status !== 'new') setStatus('new'); else await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container">
      <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Collected leads</h1>
        <div className="row gap-sm">
          <button className="btn" onClick={importSheet} disabled={importing}>
            {importing ? 'Importing…' : '⬇ Import from Google Sheet'}
          </button>
          <button className="btn primary" onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : '+ Add lead'}</button>
        </div>
      </div>

      {importResult && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--surface-2)', borderLeft: `3px solid ${importResult.inserted ? 'var(--success)' : 'var(--warn)'}` }}>
          {importResult.inserted > 0
            ? <strong>✓ Imported {importResult.inserted} new lead{importResult.inserted === 1 ? '' : 's'} from the Google Sheet.</strong>
            : <strong>No new leads imported.</strong>}{' '}
          <span className="muted">{importResult.found} rows read, {importResult.skipped} already known.</span>
        </div>
      )}

      <p className="muted" style={{ marginTop: 0 }}>
        Businesses imported from your Google Sheet or gathered from Yellow Pages / Google Places. Review them,
        add a contact email, then click <strong>⚡ Create demo</strong> to auto-generate a tenant website from
        each business's details and its own site.
      </p>

      {err && <div className="error">{err}</div>}

      {genMsg && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--surface-2)', borderLeft: '3px solid var(--success)' }}>
          <strong>✓ Demo created for {genMsg.business}.</strong>{' '}
          <span className="muted">
            Generated from “{genMsg.template}” {genMsg.usedClaude ? 'with Claude' : 'from a template'}. It's in the{' '}
            <a href="/admin/outreach">Review queue</a> (hidden until you approve).{' '}
            <a href={genMsg.url} target="_blank" rel="noreferrer">Preview →</a>
          </span>
        </div>
      )}

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="row gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>⚡ Auto-generate demos from template:</span>
          {templates.length === 0 ? (
            <span className="muted">No templates yet — <a href="/admin/new">create one</a> first.</span>
          ) : (
            <select className="input" style={{ maxWidth: 280 }} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
              ))}
            </select>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            {claudeOn ? 'Claude is configured — copy is written from each business’s own website.'
                      : 'No Claude key set — demos use a template with the lead’s details.'}
          </span>
        </div>
      </section>

      <CollectLeads onCollected={load} onError={setErr} />

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
              {data.items.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  canGenerate={templates.length > 0 && !!templateId}
                  onGenerate={generateDemo}
                  onCreateTenant={createTenant}
                  onChanged={load}
                  onError={setErr}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CollectLeads({ onCollected, onError }) {
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function collect() {
    if (!category.trim()) return;
    setBusy(true); setResult(null); onError('');
    try {
      const r = await api.collectLeads({ category: category.trim(), location: location.trim() });
      setResult(r);
      await onCollected();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card finder">
      <div className="row between" style={{ alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>🛰 Collect leads</h2>
        <span className="muted" style={{ fontSize: 12 }}>pick a category &amp; location — we gather businesses for you</span>
      </div>

      <div className="row gap-sm" style={{ flexWrap: 'wrap', margin: '12px 0' }}>
        {CATEGORY_PRESETS.map((c) => (
          <button key={c} type="button" className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="finder-grid" style={{ marginBottom: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Category / niche</label>
          <input className="input" placeholder="e.g. dentists" value={category} disabled={busy}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && collect()} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Location</label>
          <input className="input" placeholder="e.g. Sydney NSW" value={location} disabled={busy}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && collect()} />
        </div>
      </div>

      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <button className="btn primary" disabled={busy || !category.trim()} onClick={collect}>
          {busy ? 'Collecting…' : '🛰 Collect leads'}
        </button>
        {busy && <span className="muted" style={{ fontSize: 12 }}>searching directories — this can take a few seconds…</span>}
      </div>

      {result && (
        <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)', borderLeft: `3px solid ${result.inserted ? 'var(--success)' : 'var(--warn)'}` }}>
          {result.inserted > 0
            ? <strong>✓ Added {result.inserted} new lead{result.inserted === 1 ? '' : 's'}.</strong>
            : <strong>No new leads added.</strong>}{' '}
          <span className="muted">
            {result.found} found, {result.skipped} already known.
            {result.blocked && ' The Yellow Pages source was rate-limited (try again, or add a Places API key).'}
            {!result.placesConfigured && ' Tip: set PLACES_API_KEY for far more reliable results.'}
          </span>
        </div>
      )}
    </section>
  );
}

function LeadRow({ lead, canGenerate, onGenerate, onCreateTenant, onChanged, onError }) {
  const [email, setEmail] = useState(lead.email || '');
  const [busy, setBusy] = useState('');
  const dirty = (email || '') !== (lead.email || '');
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function act(kind, fn) {
    setBusy(kind);
    try { await fn(); await onChanged(); }
    catch (e) { onError(e.message); }
    finally { setBusy(''); }
  }

  async function createDemo() {
    setBusy('gen');
    try {
      // Persist an edited-but-unsaved email first so the demo uses it.
      if (dirty) await api.updateLead(lead.id, { email });
      await onGenerate({ ...lead, email });
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy('');
    }
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
        {lead.status !== 'dismissed' && (
          <button
            className="btn primary"
            disabled={!!busy || !canGenerate || !emailValid}
            title={!canGenerate ? 'Pick a template above first' : !emailValid ? 'Add a valid contact email first' : 'Generate a demo website for this business'}
            onClick={createDemo}
          >
            {busy === 'gen' ? 'Generating…' : '⚡ Create demo'}
          </button>
        )}{' '}
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
        </button>{' '}
        <button
          className="btn primary"
          disabled={!!busy}
          title="Mark this lead reviewed and open the New Tenant form prefilled with its details"
          onClick={() => onCreateTenant(lead)}
        >
          ✓ Reviewed — pass to create a tenant
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
