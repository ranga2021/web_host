import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Dashboard() {
  const [demos, setDemos] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [inquiriesCount, setInquiriesCount] = useState(null);
  const [outreach, setOutreach] = useState({ items: [], counts: {}, emailConfigured: true });
  const [leads, setLeads] = useState({ items: [], counts: {} });
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function load() {
    try {
      const [d, t, inq, out, lds] = await Promise.all([
        api.listDemos(),
        api.listTenants().catch(() => []),
        api.listInquiries().catch(() => ({ counts: {}, inquiries: [] })),
        api.listOutreach().catch(() => ({ items: [], counts: {}, emailConfigured: true })),
        api.listLeads().catch(() => ({ items: [], counts: {} })),
      ]);
      setDemos(d);
      setTenants(t);
      setInquiriesCount(inq.inquiries?.length || 0);
      setOutreach(out);
      setLeads(lds);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function action(fn) {
    try {
      await fn();
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  const items = outreach.items || [];
  const upcoming = useMemo(
    () => items.filter((o) => o.status === 'draft' || o.status === 'failed'),
    [items],
  );
  const sent = useMemo(
    () => items.filter((o) => o.status === 'sent'),
    [items],
  );
  const leadItems = leads.items || [];
  const newLeads = leadItems.filter((l) => l.status === 'new').length;
  const suggestions = useMemo(
    () => buildSuggestions(items, inquiriesCount, outreach.emailConfigured, leadItems),
    [items, inquiriesCount, outreach.emailConfigured, leadItems],
  );

  if (!demos) return <div className="container muted">Loading…</div>;

  const totalViews = demos.reduce((acc, d) => acc + (d.views?.total || 0), 0)
                   + tenants.reduce((acc, t) => acc + (t.views?.total || 0), 0);
  const readyCount = demos.filter((d) => d.status === 'ready' && d.enabled).length;

  return (
    <div className="container">
      <div className="row between" style={{ marginBottom: 18 }}>
        <h1>Dashboard</h1>
        <div className="row gap-sm">
          <button className="btn" onClick={() => nav('/outreach')}>Review queue</button>
          <button className="btn primary" onClick={() => nav('/new')}>+ New template</button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label">Templates</div>
          <div className="value">{demos.length}</div>
          <div className="sub">{readyCount} live</div>
        </div>
        <div className="stat">
          <div className="label">Leads</div>
          <div className="value">{newLeads}</div>
          <div className="sub">
            {newLeads > 0
              ? <Link to="/leads">to review →</Link>
              : 'none collected'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Pipeline</div>
          <div className="value">{upcoming.length}</div>
          <div className="sub">
            {upcoming.length > 0
              ? <Link to="/outreach">awaiting review →</Link>
              : 'nothing queued'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Emails sent</div>
          <div className="value">{sent.length}</div>
          <div className="sub">{sumViews(sent).toLocaleString()} demo views</div>
        </div>
        <div className="stat">
          <div className="label">Total views</div>
          <div className="value">{totalViews.toLocaleString()}</div>
          <div className="sub">across all demos</div>
        </div>
        <div className="stat">
          <div className="label">Inquiries</div>
          <div className="value">{inquiriesCount ?? 0}</div>
          <div className="sub">
            {inquiriesCount === 0
              ? 'awaiting first claim'
              : <Link to="/inquiries">view all →</Link>}
          </div>
        </div>
      </div>

      {err && <div className="error">{err}</div>}

      {/* AI suggestions */}
      <section className="card insights" style={{ marginBottom: 20 }}>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>✨ AI suggestions</h2>
          <span className="muted" style={{ fontSize: 12 }}>next best actions for your pipeline</span>
        </div>
        <div className="suggestion-list">
          {suggestions.map((s, i) => (
            <div key={i} className={`suggestion ${s.tone}`}>
              <span className="s-icon">{s.icon}</span>
              <span className="s-text">{s.text}</span>
              {s.to && <Link className="btn s-cta" to={s.to}>{s.cta} →</Link>}
              {s.href && <a className="btn s-cta" href={s.href} target="_blank" rel="noreferrer">{s.cta} →</a>}
            </div>
          ))}
        </div>
      </section>

      {/* Collected leads awaiting review */}
      <OutreachPanel
        title="Recently collected — leads to review"
        empty="No collected leads yet. Run the bot's collect command, or add prospects from Find new projects below."
        items={leadItems.filter((l) => l.status === 'new')}
        emptyCta={{ to: '/leads', label: 'Open leads' }}
        seeAll="/leads"
        render={(l) => (
          <>
            <div className="row between">
              <strong className="ellipsis">{l.business}</strong>
              <span className="badge">{l.source || 'manual'}</span>
            </div>
            <div className="mono muted ellipsis" style={{ fontSize: 12 }}>
              {l.email ? l.email : (l.website ? shortUrl(l.website) : 'no email / site yet')}
            </div>
            {l.region && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{l.region}</div>}
          </>
        )}
      />

      {/* Outbound pipeline: upcoming + sent */}
      <div className="pipe-grid" style={{ marginTop: 16 }}>
        <OutreachPanel
          title="Next up — pending review"
          empty="No drafts queued. Generate demos with the bot, or add leads to your sheet."
          items={upcoming}
          emptyCta={{ to: '/outreach', label: 'Open review queue' }}
          render={(o) => (
            <>
              <div className="row between">
                <strong className="ellipsis">{o.business}</strong>
                <StatusDot status={o.status} />
              </div>
              <div className="mono muted ellipsis" style={{ fontSize: 12 }}>{o.email_to}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                drafted {relativeTime(o.generated_at || o.created_at)}
              </div>
            </>
          )}
        />

        <OutreachPanel
          title="Already sent"
          empty="No emails sent yet. Approve a draft to send your first pitch."
          items={sent}
          emptyCta={{ to: '/outreach', label: 'Open review queue' }}
          render={(o) => (
            <>
              <div className="row between">
                <strong className="ellipsis">{o.business}</strong>
                <span className="views-pill" title="real demo views">
                  👁 {o.view_count || 0}
                </span>
              </div>
              <div className="mono muted ellipsis" style={{ fontSize: 12 }}>{o.email_to}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                sent {relativeTime(o.sent_at)}
                {o.view_count > 0 && <span className="opened"> · opened</span>}
              </div>
            </>
          )}
        />
      </div>

      {/* Find new projects */}
      <FindProjects />

      {/* Templates */}
      <h2 style={{ marginTop: 28 }}>Templates</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {demos.length === 0 ? (
          <div className="empty">
            No templates yet. <Link to="/new">Create one</Link>.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Demo URL</th>
                <th style={{ textAlign: 'right' }}>Views</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {demos.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link to={`/demos/${d.id}`} style={{ fontWeight: 600 }}>{d.name}</Link>
                  </td>
                  <td className="mono muted">{d.slug}</td>
                  <td>
                    <span className={`badge ${d.status}`}>{d.status}</span>
                    {!d.enabled && <span className="badge disabled" style={{ marginLeft: 6 }}>disabled</span>}
                  </td>
                  <td>
                    {d.status === 'ready' && d.enabled ? (
                      <a href={d.url} target="_blank" rel="noreferrer" className="mono">{d.url}</a>
                    ) : (
                      <span className="muted mono">{d.url}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {d.views?.total ? d.views.total.toLocaleString() : <span className="muted">—</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{relativeTime(d.updated_at)}</td>
                  <td className="actions">
                    <button className="btn" onClick={() => action(() => api.rebuild(d.id))}>Rebuild</button>{' '}
                    {d.enabled ? (
                      <button className="btn" onClick={() => action(() => api.disable(d.id))}>Disable</button>
                    ) : (
                      <button className="btn" onClick={() => action(() => api.enable(d.id))}>Enable</button>
                    )}{' '}
                    <button
                      className="btn danger"
                      onClick={() => {
                        if (confirm(`Delete "${d.name}"? This removes its files.`)) {
                          action(() => api.deleteDemo(d.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── outreach list panel (upcoming / sent / leads) ─────────────────────── */
function OutreachPanel({ title, items, render, empty, emptyCta, seeAll = '/outreach' }) {
  const shown = items.slice(0, 6);
  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="panel-head">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span className="count-pill">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="empty" style={{ padding: '32px 20px' }}>
          {empty}
          {emptyCta && <div style={{ marginTop: 10 }}><Link className="btn" to={emptyCta.to}>{emptyCta.label}</Link></div>}
        </div>
      ) : (
        <>
          <ul className="lead-list">
            {shown.map((o) => (
              <li key={o.id}>{render(o)}</li>
            ))}
          </ul>
          {items.length > shown.length && (
            <Link className="panel-more" to={seeAll}>
              View all {items.length} →
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function shortUrl(u) {
  return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/* ── lead-finding helper ───────────────────────────────────────────────── */
const SECTOR_PRESETS = ['Restaurants', 'Dentists', 'Gyms', 'Law firms', 'Real estate agents', 'Plumbers', 'Cafes', 'Salons'];

function FindProjects() {
  const [sector, setSector] = useState('');
  const [location, setLocation] = useState('');

  const q = [sector, location].filter(Boolean).join(' ').trim();
  const enc = encodeURIComponent;
  const sources = q
    ? [
        { label: 'Google Maps', hint: 'Local businesses — note the ones with no website', href: `https://www.google.com/maps/search/${enc(q)}` },
        { label: 'No-website leads', hint: 'Maps listings missing a site = warmest leads', href: `https://www.google.com/maps/search/${enc(q + ' no website')}` },
        { label: 'LinkedIn', hint: 'Find owners & decision-makers', href: `https://www.linkedin.com/search/results/companies/?keywords=${enc(q)}` },
        { label: 'Yellow Pages', hint: 'Bulk listings with phone & address', href: `https://www.yellowpages.com/search?search_terms=${enc(sector || q)}&geo_location_terms=${enc(location)}` },
      ]
    : [];

  return (
    <section className="card finder" style={{ marginTop: 20 }}>
      <div className="row between" style={{ alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>🔭 Find new projects</h2>
        <span className="muted" style={{ fontSize: 12 }}>build a prospecting search, then drop leads into your sheet</span>
      </div>

      <div className="row gap-sm" style={{ flexWrap: 'wrap', margin: '12px 0' }}>
        {SECTOR_PRESETS.map((s) => (
          <button
            key={s}
            className={`chip ${sector === s ? 'active' : ''}`}
            onClick={() => setSector(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="finder-grid">
        <div className="field" style={{ margin: 0 }}>
          <label>Business type / niche</label>
          <input className="input" placeholder="e.g. dentists" value={sector} onChange={(e) => setSector(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Location</label>
          <input className="input" placeholder="e.g. Melbourne" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      {q ? (
        <div className="source-grid">
          {sources.map((s) => (
            <a key={s.label} className="source" href={s.href} target="_blank" rel="noreferrer">
              <strong>{s.label}</strong>
              <span className="muted">{s.hint}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Pick a niche above (or type one) and add a location to generate prospecting links.
        </div>
      )}
    </section>
  );
}

/* ── AI suggestion engine (data-driven next-best-actions) ──────────────── */
function buildSuggestions(items, inquiriesCount, emailConfigured, leads = []) {
  const out = [];
  const newLeads = leads.filter((l) => l.status === 'new');
  const leadsNoEmail = newLeads.filter((l) => !l.email);
  const drafts = items.filter((o) => o.status === 'draft');
  const failed = items.filter((o) => o.status === 'failed');
  const sent = items.filter((o) => o.status === 'sent');
  const opened = sent.filter((o) => (o.view_count || 0) > 0);
  const cold = sent.filter((o) => (o.view_count || 0) === 0 && daysSince(o.sent_at) >= 3);
  const staleDrafts = drafts.filter((o) => daysSince(o.generated_at || o.created_at) >= 2);

  if (emailConfigured === false) {
    out.push({
      tone: 'warn', icon: '⚠️',
      text: 'No email provider is configured — approvals will mark demos sent but nothing will actually go out. Add a RESEND_API_KEY.',
      to: '/settings', cta: 'Settings',
    });
  }
  if (failed.length) {
    out.push({
      tone: 'danger', icon: '🔁',
      text: `${failed.length} email${failed.length === 1 ? '' : 's'} failed to send. Re-check the address and retry from the review queue.`,
      to: '/outreach', cta: 'Fix & retry',
    });
  }
  if (staleDrafts.length) {
    out.push({
      tone: 'warn', icon: '⏳',
      text: `${staleDrafts.length} draft${staleDrafts.length === 1 ? ' has' : 's have'} been waiting 2+ days. Approve them while the leads are still warm.`,
      to: '/outreach', cta: 'Review now',
    });
  } else if (drafts.length) {
    out.push({
      tone: 'info', icon: '📨',
      text: `${drafts.length} demo${drafts.length === 1 ? '' : 's'} ready for review. A quick approve sends the pitch and publishes the site.`,
      to: '/outreach', cta: 'Review',
    });
  }
  if (opened.length) {
    const hot = [...opened].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
    out.push({
      tone: 'good', icon: '🔥',
      text: `${hot.business} opened their demo ${hot.view_count} time${hot.view_count === 1 ? '' : 's'}${opened.length > 1 ? ` (and ${opened.length - 1} other prospect${opened.length - 1 === 1 ? '' : 's'} are engaging)` : ''} — follow up while you're top of mind.`,
      to: '/outreach', cta: 'See engagement',
    });
  }
  if (cold.length) {
    out.push({
      tone: 'info', icon: '💤',
      text: `${cold.length} sent demo${cold.length === 1 ? '' : 's'} ${cold.length === 1 ? 'has' : 'have'} not been opened in 3+ days. A short follow-up nudge usually doubles open rates.`,
      to: '/outreach', cta: 'View sent',
    });
  }
  if (leadsNoEmail.length) {
    out.push({
      tone: 'info', icon: '✉️',
      text: `${leadsNoEmail.length} collected lead${leadsNoEmail.length === 1 ? '' : 's'} ${leadsNoEmail.length === 1 ? 'is' : 'are'} missing a contact email. Add emails so the generator can pitch them.`,
      to: '/leads', cta: 'Add emails',
    });
  } else if (newLeads.length) {
    out.push({
      tone: 'good', icon: '🧭',
      text: `${newLeads.length} collected lead${newLeads.length === 1 ? '' : 's'} ready with an email — run the generator to draft their demos.`,
      to: '/leads', cta: 'Review leads',
    });
  }
  if (drafts.length === 0 && sent.length === 0 && newLeads.length === 0) {
    out.push({
      tone: 'info', icon: '🌱',
      text: 'Your pipeline is empty. Collect businesses with the bot (or Find new projects below), then review them under Leads.',
      to: '/leads', cta: 'View leads',
    });
  } else if (drafts.length < 3 && newLeads.length === 0) {
    out.push({
      tone: 'info', icon: '➕',
      text: 'Pipeline is running low. Line up more prospects so the generator has fresh businesses to draft tomorrow.',
    });
  }

  if (out.length === 0) {
    out.push({ tone: 'good', icon: '✅', text: "You're all caught up — no pending actions in the pipeline." });
  }
  return out.slice(0, 5);
}

/* ── small presentational helpers ──────────────────────────────────────── */
function StatusDot({ status }) {
  const map = { draft: ['#b45309', 'pending'], failed: ['#b91c1c', 'failed'] };
  const [color, label] = map[status] || ['#6b7280', status];
  return <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</span>;
}

function sumViews(list) {
  return list.reduce((a, o) => a + (o.view_count || 0), 0);
}

function daysSince(iso) {
  if (!iso) return 0;
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  return (Date.now() - then) / 86_400_000;
}

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60)     return `${sec}s ago`;
  if (sec < 3600)   return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)  return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(then).toLocaleDateString();
}
