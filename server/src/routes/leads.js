import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { queries } from '../db.js';
import { notify } from '../notify.js';
import { collectLeads, placesConfigured } from '../leadSources.js';

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
