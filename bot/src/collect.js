import { config, live } from './config.js';
import { log } from './log.js';
import { makeSheets } from './sheets.js';
import { searchYellowPages } from './sources/yellowpages.js';
import { searchPlaces } from './sources/places.js';

// Normalize a name/website into a dedupe key.
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const hostKey = (url) => {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`).host.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
};

// Which sources to run. Facebook/LinkedIn are intentionally unsupported — no
// compliant scraping path — so we warn and skip rather than pretend.
function resolveSources(sel) {
  const want = sel === 'all' ? ['yp', 'places'] : [sel];
  const runners = [];
  for (const s of want) {
    if (s === 'yp') runners.push({ name: 'yellowpages', run: searchYellowPages });
    else if (s === 'places') {
      if (live.places) runners.push({ name: 'google-places', run: searchPlaces });
      else log.warn('places: skipped (no PLACES_API_KEY set)');
    } else if (s === 'facebook' || s === 'linkedin') {
      log.warn(`${s}: not supported — scraping it violates their ToS and they block bots. Add such leads to the sheet manually.`);
    } else {
      log.warn(`unknown source "${s}" — use yp | places | all`);
    }
  }
  return runners;
}

export async function runCollect() {
  const mode = config.dryRun ? 'DRY-RUN' : 'LIVE';
  log.info(`bot collect — mode=${mode}, source=${config.collectSource}, limit=${config.collectLimit}`);
  if (!config.collectTerm) {
    throw new Error('collect needs a search term: --term="glass repair" [--location="Sydney NSW"]');
  }

  const runners = resolveSources(config.collectSource);
  if (!runners.length) { log.warn('no usable sources — nothing to do'); return []; }

  const sheets = await makeSheets();

  // Existing rows → dedupe keys, so we never append a business already tracked.
  const existing = await sheets.readBusinesses().catch((e) => { log.warn(`read existing failed: ${e.message}`); return []; });
  const seenNames = new Set(existing.map((r) => nameKey(r.business)).filter(Boolean));
  const seenHosts = new Set(existing.map((r) => hostKey(r.website)).filter(Boolean));
  log.info(`dedupe baseline: ${seenNames.size} known businesses in the sheet`);

  // Gather from every source, then dedupe across sources + the sheet.
  const collected = [];
  for (const r of runners) {
    try {
      const found = await r.run({
        term: config.collectTerm,
        location: config.collectLocation,
        maxPages: config.collectMaxPages,
        limit: config.collectLimit,
      });
      collected.push(...found);
    } catch (err) {
      log.error(`${r.name}: ${err.message}`);
    }
  }

  const fresh = [];
  for (const c of collected) {
    const nk = nameKey(c.business);
    const hk = hostKey(c.website);
    if (!nk) continue;
    if (seenNames.has(nk) || (hk && seenHosts.has(hk))) continue; // already known / dup
    seenNames.add(nk); if (hk) seenHosts.add(hk);
    fresh.push({
      business: c.business,
      category: c.category || '',
      website: c.website || '',
      hasWebsite: c.website ? 'Yes' : 'No',
      region: config.collectLocation || '',
      phone: c.phone || '',
      address: c.address || '',
      source: c.source || config.collectSource,
    });
    if (fresh.length >= config.collectLimit) break;
  }

  log.info(`collected ${collected.length}, ${fresh.length} new after dedupe`);
  if (fresh.length) {
    const n = await sheets.appendBusinesses(fresh);
    log.ok(`appended ${n} new lead(s) to the sheet (Contact Email left blank — fill before pitching)`);
  }

  log.info('──────────────────────────────────────');
  for (const f of fresh) log.ok(`  + ${f.business}${f.website ? ` — ${f.website}` : ' (no website)'}`);
  return fresh;
}
