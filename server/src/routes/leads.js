import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { queries } from '../db.js';
import { notify } from '../notify.js';
import { collectLeads, placesConfigured } from '../leadSources.js';
import { fetchSheetLeads } from '../sheetImport.js';
import { slugify, slugCandidate, validateSlug } from '../slug.js';
import { recFromLead, enrichFromWebsite, generateSiteConfig, renderEmailDraft, isEmail, claudeConfigured } from '../siteGen.js';

const router = Router();
router.use(requireAuth);

// Normalized dedupe key: business name + website host. Two listings collide
// if they share a name OR a website host (host alone is a strong signal).
function nameKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function hostKey(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`).host.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}
function dedupeKey(business, website) {
  const h = hostKey(website);
  return h ? `h:${h}` : `n:${nameKey(business)}`;
}

const counts = () => Object.fromEntries(queries.countLeadsByStatus.all().map((r) => [r.status, r.n]));

// Insert a batch of collected/raw leads, deduped via dedupe_key. Returns the
// number actually inserted (OR IGNORE skips ones already known).
function insertLeads(records, source) {
  let inserted = 0;
  for (const l of records) {
    if (!l?.business) continue;
    const info = queries.insertLead.run({
      business: l.business,
      website: l.website || null,
      email: l.email || null,
      phone: l.phone || null,
      address: l.address || null,
      category: l.category || null,
      region: l.region || null,
      source: l.source || source || 'collect',
      dedupe_key: dedupeKey(l.business, l.website),
    });
    inserted += info.changes;
  }
  return inserted;
}

// List all leads (optionally by status), with status counts for the tabs/badges.
router.get('/', (req, res) => {
  const rows = req.query.status
    ? queries.listLeadsByStatus.all(String(req.query.status))
    : queries.listLeads.all();
  res.json({ items: rows, counts: counts() });
});

router.get('/:id', (req, res) => {
  const lead = queries.getLead.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  res.json(lead);
});

// Bulk insert — called by the bot's `collect` command. Idempotent via dedupe_key.
router.post('/bulk', async (req, res) => {
  const incoming = Array.isArray(req.body?.leads) ? req.body.leads : [];
  const inserted = insertLeads(incoming);
  if (inserted > 0) {
    await notify({
      kind: 'leads_collected',
      title: `${inserted} new lead${inserted === 1 ? '' : 's'} collected`,
      body: 'The bot gathered new businesses. Review them and add contact emails.',
      link: '/admin/leads',
    });
  }
  res.status(201).json({ inserted, skipped: incoming.length - inserted, counts: counts() });
});

// Collect on demand — the dashboard "Collect leads" button. Runs the sources
// (Google Places if a key is set, else/also Yellow Pages), dedupes, inserts,
// and returns the fresh items so the UI can list them immediately.
router.post('/collect', async (req, res) => {
  const term = String(req.body?.category || req.body?.term || '').trim();
  const location = String(req.body?.location || '').trim();
  const source = String(req.body?.source || 'all').trim();
  const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 25));
  if (!term) return res.status(400).json({ error: 'category is required' });

  let found, blocked, ran;
  try {
    ({ results: found, blocked, ran } = await collectLeads({ term, location, source, limit }));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  // Stamp the search location as the region for everything we just found.
  const records = found.map((r) => ({ ...r, region: location || r.address || '' }));
  const inserted = insertLeads(records);

  if (inserted > 0) {
    await notify({
      kind: 'leads_collected',
      title: `${inserted} new lead${inserted === 1 ? '' : 's'} collected`,
      body: `Search: ${term}${location ? ` in ${location}` : ''}. Review them and add contact emails.`,
      link: '/admin/leads',
    });
  }

  res.json({
    inserted,
    found: found.length,
    skipped: found.length - inserted,
    blocked: !!blocked,
    ran,
    placesConfigured: placesConfigured(),
    counts: counts(),
    items: queries.listLeadsByStatus.all('new'),
  });
});

// Import straight from the configured Google Sheet — the dashboard "Import
// from Google Sheet" button. Reads the public CSV export (no credentials),
// maps rows to leads, and inserts them deduped. Optional body overrides let
// the caller point at a different sheet/tab.
router.post('/import-sheet', async (req, res) => {
  let leads;
  try {
    leads = await fetchSheetLeads({
      sheetId: req.body?.sheetId?.trim() || undefined,
      gid: req.body?.gid?.toString().trim() || undefined,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  const inserted = insertLeads(leads, 'google-sheet');
  if (inserted > 0) {
    await notify({
      kind: 'leads_collected',
      title: `${inserted} lead${inserted === 1 ? '' : 's'} imported from Google Sheet`,
      body: 'Rows from the connected Google Sheet were added. Review them and add contact emails.',
      link: '/admin/leads',
    });
  }

  res.json({
    inserted,
    found: leads.length,
    skipped: leads.length - inserted,
    counts: counts(),
    items: queries.listLeadsByStatus.all('new'),
  });
});

// Create a demo tenant automatically from a lead + a chosen template.
// Generates the site content from the lead's details and its own website
// (Claude when configured, else a template), creates a DISABLED tenant, and
// queues an outreach draft for review — exactly like the bot's generate step.
router.post('/:id/generate-demo', async (req, res) => {
  const lead = queries.getLead.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });

  const template = queries.getDemoById.get(Number(req.body?.template_id));
  if (!template) return res.status(400).json({ error: 'select a template first' });

  const email = (lead.email || '').trim();
  if (!isEmail(email)) return res.status(400).json({ error: 'add a valid contact email before creating a demo' });

  try {
    // 1. Generate site content, grounded on the lead's real website.
    const rec = recFromLead(lead);
    const enrichment = await enrichFromWebsite(lead.website);
    const { config: siteCfg, usedClaude } = await generateSiteConfig(rec, enrichment);

    // 2. Create the tenant DISABLED (hidden until approved), retrying on slug collisions.
    const base = slugify(lead.business);
    let tenant = null;
    for (let attempt = 1; attempt <= 8 && !tenant; attempt++) {
      const slug = slugCandidate(base, attempt);
      if (validateSlug(slug)) continue;
      if (queries.getTenantBySlug(slug) || queries.getDemoBySlug.get(slug)) continue;
      const info = queries.insertTenant.run({
        slug, name: lead.business, template_id: template.id, config: JSON.stringify(siteCfg),
      });
      tenant = queries.getTenantById(info.lastInsertRowid);
    }
    if (!tenant) return res.status(409).json({ error: 'could not allocate a unique slug for this business' });
    queries.setTenantEnabled.run(0, tenant.id);

    // 3. Draft the outreach email and queue it for review.
    const demoUrl = `${config.publicBaseUrl}/${tenant.slug}/`;
    const draft = renderEmailDraft(rec, demoUrl);
    const o = queries.insertOutreach.run({
      tenant_id: tenant.id,
      sheet_row: null,
      business: lead.business,
      email_to: email,
      email_subject: draft.subject,
      email_body: draft.body,
      demo_url: demoUrl,
    });

    // 4. Take the lead out of the review list, noting the demo it produced.
    queries.updateLead.run({
      id: lead.id,
      business: lead.business, website: lead.website, email: lead.email, phone: lead.phone,
      address: lead.address, category: lead.category, region: lead.region,
      notes: `Demo created → ${demoUrl}`,
    });
    queries.setLeadStatus.run({ id: lead.id, status: 'dismissed' });

    await notify({
      kind: 'drafts_ready',
      title: `Demo drafted for ${lead.business}`,
      body: `A website demo was generated from "${template.name}". Review and approve to send.`,
      link: '/admin/outreach',
    });

    res.status(201).json({
      tenant: { id: tenant.id, slug: tenant.slug, url: demoUrl },
      outreach_id: o.lastInsertRowid,
      demo_url: demoUrl,
      usedClaude,
      template: { id: template.id, name: template.name },
      counts: counts(),
    });
  } catch (err) {
    res.status(500).json({ error: `demo generation failed: ${err.message}` });
  }
});

// Which templates are available to generate from + whether Claude is wired up.
router.get('/generate/options', (req, res) => {
  const templates = queries.listDemos.all().map((d) => ({ id: d.id, name: d.name, slug: d.slug, status: d.status }));
  res.json({ templates, claudeConfigured: claudeConfigured() });
});

// Manual add of a single lead from the admin UI.
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.business?.trim()) return res.status(400).json({ error: 'business is required' });
  const info = queries.insertLead.run({
    business: b.business.trim(),
    website: b.website || null,
    email: b.email || null,
    phone: b.phone || null,
    address: b.address || null,
    category: b.category || null,
    region: b.region || null,
    source: 'manual',
    dedupe_key: dedupeKey(b.business, b.website),
  });
  if (!info.changes) return res.status(409).json({ error: 'a matching lead already exists' });
  res.status(201).json(queries.getLead.get(info.lastInsertRowid));
});

// Edit a lead's details (most importantly, fill in the contact email).
router.patch('/:id', (req, res) => {
  const lead = queries.getLead.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  const m = req.body || {};
  queries.updateLead.run({
    id: lead.id,
    business: (m.business ?? lead.business)?.trim() || lead.business,
    website: m.website ?? lead.website,
    email: m.email ?? lead.email,
    phone: m.phone ?? lead.phone,
    address: m.address ?? lead.address,
    category: m.category ?? lead.category,
    region: m.region ?? lead.region,
    notes: m.notes ?? lead.notes,
  });
  res.json(queries.getLead.get(lead.id));
});

router.post('/:id/dismiss', (req, res) => {
  const lead = queries.getLead.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  queries.setLeadStatus.run({ id: lead.id, status: 'dismissed' });
  res.json(queries.getLead.get(lead.id));
});

router.post('/:id/restore', (req, res) => {
  const lead = queries.getLead.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'not found' });
  queries.setLeadStatus.run({ id: lead.id, status: 'new' });
  res.json(queries.getLead.get(lead.id));
});

router.delete('/:id', (req, res) => {
  queries.deleteLead.run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
