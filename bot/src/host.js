import fsp from 'node:fs/promises';
import path from 'node:path';
import { config, live } from './config.js';
import { log } from './log.js';
import { slugCandidate } from './slug.js';

// Thin client for the web_host REST API. Logs in once (password → wht_session
// cookie) and reuses the cookie. In the new flow the bot:
//   1. creates a tenant DISABLED (hidden until the admin approves)
//   2. creates an `outreach` draft row (the review-queue item)
// and never sends email — the server sends on approval.
async function makeLiveHost() {
  const base = config.hostBaseUrl;
  let cookie = '';

  async function login() {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: config.hostAdminPassword }),
    });
    if (!res.ok) throw new Error(`host login failed: ${res.status} ${await res.text()}`);
    const setCookie = (res.headers.getSetCookie?.() || [res.headers.get('set-cookie')]).filter(Boolean);
    const m = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('wht_session='));
    if (!m) throw new Error('host login: no wht_session cookie returned');
    cookie = m;
  }

  async function api(method, p, body) {
    const res = await fetch(`${base}${p}`, {
      method, headers: { 'content-type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    return { status: res.status, json };
  }

  await login();
  const demos = await api('GET', '/api/demos');
  if (demos.status !== 200) throw new Error(`list demos failed: ${demos.status}`);
  const template = (Array.isArray(demos.json) ? demos.json : []).find((d) => d.slug === config.templateSlug);
  if (!template) throw new Error(`template slug "${config.templateSlug}" not found on host (have: ${(demos.json || []).map((d) => d.slug).join(', ') || 'none'})`);

  return {
    backend: `web_host live @ ${base} (template: ${config.templateSlug})`,
    template,
    async createDraft({ baseSlug, name, config: cfg, rec, emailDraft }) {
      // 1. Create tenant (collision retry), then disable it (hidden until approved).
      let created = null;
      for (let attempt = 1; attempt <= 6 && !created; attempt++) {
        const slug = slugCandidate(baseSlug, attempt);
        const r = await api('POST', '/api/tenants', { slug, name, template_id: template.id, config: cfg });
        if (r.status === 201) created = { slug, url: r.json.url, id: r.json.id };
        else if (r.status === 409) { log.warn(`slug "${slug}" taken, retrying`); }
        else throw new Error(`createTenant failed (${r.status}): ${JSON.stringify(r.json)}`);
      }
      if (!created) throw new Error(`no free slug for "${baseSlug}"`);
      await api('POST', `/api/tenants/${created.id}/disable`); // hidden until approved

      // 2. Create the outreach draft (the review-queue item).
      const o = await api('POST', '/api/outreach', {
        tenant_id: created.id,
        sheet_row: rec.rowNumber,
        business: rec.business,
        email_to: emailDraft.to,
        email_subject: emailDraft.subject,
        email_body: emailDraft.body,
        demo_url: created.url,
      });
      if (o.status !== 201 && o.status !== 200) throw new Error(`createOutreach failed (${o.status}): ${JSON.stringify(o.json)}`);
      return { slug: created.slug, url: created.url, tenantId: created.id, outreachId: o.json.id };
    },
    async announce(count) {
      await api('POST', '/api/outreach/announce', { count });
    },
    async syncPending() {
      const r = await api('GET', '/api/outreach/sync/pending');
      return r.status === 200 ? r.json : [];
    },
    async markSynced(id) {
      await api('POST', `/api/outreach/sync/${id}/done`);
    },
    async createLeads(records) {
      const r = await api('POST', '/api/leads/bulk', { leads: records });
      if (r.status !== 201 && r.status !== 200) throw new Error(`createLeads failed (${r.status}): ${JSON.stringify(r.json)}`);
      return r.json; // { inserted, skipped, counts }
    },
  };
}

// Dry-run: write the draft to disk and return a deterministic URL.
async function makeDryHost() {
  return {
    backend: 'dry host (writes drafts to bot/_dryrun/)',
    template: { id: 0, slug: config.templateSlug },
    async createDraft({ baseSlug, name, config: cfg, rec, emailDraft }) {
      const dir = path.join(config.dryRunDir, 'drafts');
      await fsp.mkdir(dir, { recursive: true });
      const url = `${config.publicBaseUrl}/${baseSlug}/`;
      await fsp.writeFile(
        path.join(dir, `${baseSlug}.json`),
        JSON.stringify({ slug: baseSlug, name, enabled: false, demo_url: url, sheet_row: rec.rowNumber, email: emailDraft, config: cfg }, null, 2),
      );
      const emDir = path.join(config.dryRunDir, 'emails');
      await fsp.mkdir(emDir, { recursive: true });
      await fsp.writeFile(path.join(emDir, `${baseSlug}.txt`), `To: ${emailDraft.to}\nSubject: ${emailDraft.subject}\n\n${emailDraft.body}`);
      return { slug: baseSlug, url, tenantId: null, outreachId: null };
    },
    async announce(count) { log.info(`(dry) would notify: ${count} drafts ready for review`); },
    async syncPending() { return []; },
    async markSynced() {},
    async createLeads(records) { log.info(`(dry) would push ${records.length} lead(s) to the host`); return { inserted: 0, skipped: records.length }; },
  };
}

export async function makeHost() {
  const h = live.host ? await makeLiveHost() : await makeDryHost();
  log.info(`host backend: ${h.backend}`);
  return h;
}
