import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { queries } from '../db.js';
import { sendOutreach, emailConfigured } from '../mailer.js';
import { notify } from '../notify.js';

const router = Router();
router.use(requireAuth);

function serialize(o) {
  if (!o) return null;
  const tenant = queries.getTenantById(o.tenant_id);
  return {
    ...o,
    tenant: tenant
      ? { id: tenant.id, slug: tenant.slug, name: tenant.name, enabled: tenant.enabled, url: `${config.publicBaseUrl}/${tenant.slug}/`, config: tenant.config }
      : null,
  };
}

// List (optionally by status)
router.get('/', (req, res) => {
  const rows = req.query.status
    ? queries.listOutreachByStatus.all(String(req.query.status))
    : queries.listOutreach.all();
  res.json({
    items: rows.map(serialize),
    counts: Object.fromEntries(queries.countOutreachByStatus.all().map((r) => [r.status, r.n])),
    emailConfigured: emailConfigured(),
  });
});

router.get('/:id', (req, res) => {
  const o = queries.getOutreach.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  res.json(serialize(o));
});

// Create — called by the bot's `generate` step after it makes the (disabled) tenant.
router.post('/', (req, res) => {
  const b = req.body || {};
  const tenant = queries.getTenantById(b.tenant_id);
  if (!tenant) return res.status(400).json({ error: 'tenant_id not found' });
  if (!b.email_to || !b.email_subject || !b.email_body) {
    return res.status(400).json({ error: 'email_to, email_subject, email_body required' });
  }
  // Idempotency: one outreach per tenant.
  const existing = queries.getOutreachByTenant.get(tenant.id);
  if (existing) return res.status(200).json(serialize(existing));

  const info = queries.insertOutreach.run({
    tenant_id: tenant.id,
    sheet_row: b.sheet_row ?? null,
    business: b.business || tenant.name,
    email_to: b.email_to,
    email_subject: b.email_subject,
    email_body: b.email_body,
    demo_url: b.demo_url || `${config.publicBaseUrl}/${tenant.slug}/`,
  });
  res.status(201).json(serialize(queries.getOutreach.get(info.lastInsertRowid)));
});

// Edit the email draft.
router.patch('/:id', (req, res) => {
  const o = queries.getOutreach.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const email_subject = (req.body?.email_subject ?? o.email_subject).trim();
  const email_body = (req.body?.email_body ?? o.email_body);
  if (!email_subject || !email_body?.trim()) return res.status(400).json({ error: 'subject and body required' });
  queries.updateOutreachEmail.run({ id: o.id, email_subject, email_body });
  res.json(serialize(queries.getOutreach.get(o.id)));
});

// Approve → enable the tenant (go live) + send the email + record sent.
router.post('/:id/approve', async (req, res) => {
  const o = queries.getOutreach.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  if (o.status === 'sent') return res.status(409).json({ error: 'already sent' });

  const tenant = queries.getTenantById(o.tenant_id);
  if (!tenant) return res.status(400).json({ error: 'tenant missing' });

  try {
    queries.setTenantEnabled.run(1, tenant.id);              // go live
    await sendOutreach({ to: o.email_to, subject: o.email_subject, body: o.email_body });
    queries.setOutreachStatus.run({ id: o.id, status: 'sent', error: null, sent_at: new Date().toISOString() });
    await notify({
      kind: 'email_sent',
      title: `Email sent to ${o.business}`,
      body: `${o.email_to} — demo is now live at ${o.demo_url}`,
      link: `/admin/outreach`,
    });
    res.json(serialize(queries.getOutreach.get(o.id)));
  } catch (err) {
    // Roll the tenant back to disabled so a failed send doesn't leak a live demo.
    queries.setTenantEnabled.run(0, tenant.id);
    queries.setOutreachStatus.run({ id: o.id, status: 'failed', error: err.message.slice(0, 300), sent_at: null });
    res.status(502).json({ error: err.message });
  }
});

// Reject → keep the tenant disabled, mark rejected.
router.post('/:id/reject', (req, res) => {
  const o = queries.getOutreach.get(req.params.id);
  if (!o) return res.status(404).json({ error: 'not found' });
  const tenant = queries.getTenantById(o.tenant_id);
  if (tenant) queries.setTenantEnabled.run(0, tenant.id);
  queries.setOutreachStatus.run({ id: o.id, status: 'rejected', error: null, sent_at: null });
  res.json(serialize(queries.getOutreach.get(o.id)));
});

// Bot announces a finished generate batch → one "drafts ready" notification.
router.post('/announce', async (req, res) => {
  const count = Number(req.body?.count || 0);
  if (count > 0) {
    await notify({
      kind: 'drafts_ready',
      title: `${count} demo${count === 1 ? '' : 's'} ready for review`,
      body: 'New website demos were generated and are waiting for your approval.',
      link: '/admin/outreach',
    });
  }
  res.json({ ok: true });
});

// ---- sheet write-back sync (consumed by the bot's `sync` command) ----
router.get('/sync/pending', (req, res) => {
  res.json(queries.listOutreachNeedingSync.all().map((o) => ({
    id: o.id, sheet_row: o.sheet_row, demo_url: o.demo_url, business: o.business, sent_at: o.sent_at,
  })));
});
router.post('/sync/:id/done', (req, res) => {
  queries.markOutreachSheetSynced.run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
