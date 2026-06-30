import { config, live } from './config.js';
import { log } from './log.js';
import { slugify } from './slug.js';
import { makeSheets } from './sheets.js';
import { makeHost } from './host.js';
import { generateSiteConfig } from './ai.js';
import { enrichFromWebsite } from './enrich.js';
import { renderEmailDraft } from './email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function auDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isEligible(rec) {
  if (!rec.business || !rec.business.trim()) return false;     // separator/region rows
  if (!rec.email || !EMAIL_RE.test(rec.email)) return false;  // need a deliverable address
  if (rec.botStatus && /^(sent|draft|generated)/i.test(rec.botStatus)) return false; // already handled
  if (rec.pitchSent) return false;                            // already pitched
  if (rec.demoUrl) return false;                              // already has a demo
  return true;
}

// ── generate: read sheet → build demos + drafts (NO send) → notify ────────
export async function runGenerate() {
  const mode = config.dryRun ? 'DRY-RUN' : 'LIVE';
  log.info(`bot generate — mode=${mode}, dailyLimit=${config.dailyLimit}`);
  log.info(`live: sheetsWrite=${live.sheetsWrite} claude=${live.claude} host=${live.host}`);

  const sheets = await makeSheets();
  const host = await makeHost();

  await sheets.ensureColumns();
  const all = await sheets.readBusinesses();
  log.info(`read ${all.length} rows`);

  let pool = all.filter(isEligible);
  if (config.onlyBusiness) pool = pool.filter((r) => r.business.toLowerCase().includes(config.onlyBusiness.toLowerCase()));
  const skippedNoEmail = all.filter((r) => r.business?.trim() && (!r.email || !EMAIL_RE.test(r.email))).length;
  log.info(`${pool.length} eligible, ${skippedNoEmail} skipped (no/invalid email)`);

  const batch = pool.slice(0, config.dailyLimit);
  log.info(`generating ${batch.length} demos this run`);

  const results = [];
  for (const rec of batch) {
    const label = `${rec.business} (row ${rec.rowNumber})`;
    try {
      log.step(`── ${label}`);
      const enrichment = config.enrich ? await enrichFromWebsite(rec.website) : null;
      if (enrichment) log.info(`  enriched from ${rec.website}`);

      const { config: siteCfg } = await generateSiteConfig(rec, enrichment);
      const baseSlug = slugify(rec.business);
      const demoUrl = `${config.publicBaseUrl}/${baseSlug}/`;
      const emailDraft = renderEmailDraft(rec, demoUrl);

      const { slug, url, outreachId } = await host.createDraft({ baseSlug, name: rec.business, config: siteCfg, rec, emailDraft });
      log.ok(`  draft ready (hidden) → ${url}  [outreach ${outreachId ?? 'dry'}]`);

      // Reflect in the sheet immediately as a pending draft (no send yet).
      await sheets.writeResult(rec.rowNumber, { demoUrl: url, generated: auDate(), status: 'Draft (pending review)' });
      results.push({ business: rec.business, slug, url, ok: true });
    } catch (err) {
      log.error(`  ${label}: ${err.message}`);
      try { await sheets.writeResult(rec.rowNumber, { status: `Error: ${err.message}`.slice(0, 200) }); } catch {}
      results.push({ business: rec.business, ok: false, error: err.message });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  if (ok > 0) await host.announce(ok); // → server creates the "drafts ready" notification

  log.info('──────────────────────────────────────');
  log.info(`done: ${ok}/${results.length} demos drafted (awaiting review in the dashboard)`);
  for (const r of results) r.ok ? log.ok(`  ${r.business} → ${r.url}`) : log.error(`  ${r.business} → ${r.error}`);
  if (config.dryRun) log.info(`dry-run artifacts in: ${config.dryRunDir}`);
  return results;
}

// ── sync: write back to the sheet for outreach the admin has approved+sent ──
export async function runSync() {
  if (!live.host) { log.warn('sync needs a live host (HOST_ADMIN_PASSWORD) — nothing to do in dry mode'); return []; }
  if (!live.sheetsWrite) { log.warn('sync needs Google write creds — skipping'); return []; }

  const sheets = await makeSheets();
  const host = await makeHost();
  await sheets.ensureColumns();

  const pending = await host.syncPending();
  log.info(`sync: ${pending.length} sent outreach rows to write back`);
  const done = [];
  for (const p of pending) {
    if (!p.sheet_row) { await host.markSynced(p.id); continue; }
    try {
      await sheets.writeResult(p.sheet_row, {
        demoUrl: p.demo_url,
        emailSentDate: p.sent_at ? auDate(new Date(p.sent_at)) : auDate(),
        status: 'Sent',
        flipPitch: true,
      });
      await host.markSynced(p.id);
      log.ok(`  synced ${p.business} (row ${p.sheet_row})`);
      done.push(p.id);
    } catch (err) {
      log.error(`  sync ${p.business}: ${err.message}`);
    }
  }
  log.info(`sync done: ${done.length}/${pending.length}`);
  return done;
}

export async function run() {
  return config.command === 'sync' ? runSync() : runGenerate();
}
