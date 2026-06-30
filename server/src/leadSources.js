import { config } from './config.js';

// ── Lead sources for the dashboard "Collect leads" button ────────────────
//
// Ported from the bot's scrapers so the server can collect synchronously when
// the admin clicks the button (no shelling out to the bot CLI). Plain fetch +
// regex — no extra dependencies. Page caps are kept small so a button click
// returns in a few seconds rather than tens of seconds.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .trim();
}

// ── Yellow Pages (yellowpages.com) ───────────────────────────────────────
async function fetchPage(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' },
    });
    if (res.status === 403 || res.status === 429) return { blocked: true, html: null };
    if (!res.ok) return { blocked: false, html: null };
    return { blocked: false, html: await res.text() };
  } catch {
    return { blocked: false, html: null };
  } finally {
    clearTimeout(t);
  }
}

function parseListings(html) {
  if (!html) return [];
  const chunks = html.split(/class="(?:result|srp-listing)\b/).slice(1);
  const out = [];
  for (const chunk of chunks) {
    const pick = (re) => decode(chunk.match(re)?.[1] || '');
    const business = pick(/class="business-name"[^>]*>(?:\s*<span[^>]*>)?\s*([^<]+)/i);
    if (!business) continue;
    const website = (chunk.match(/class="[^"]*track-visit-website[^"]*"[^>]*href="([^"]+)"/i)?.[1] || '').trim();
    const phone = pick(/class="phones[^"]*"[^>]*>\s*([^<]+)/i);
    const category = pick(/class="categories"[\s\S]*?>\s*([^<]+?)\s*<\/a>/i);
    const street = pick(/class="street-address"[^>]*>\s*([^<]+)/i);
    const locality = pick(/class="locality"[^>]*>\s*([^<]+)/i);
    out.push({ business, website, phone, category, address: [street, locality].filter(Boolean).join(', '), source: 'yellowpages' });
  }
  return out;
}

async function searchYellowPages({ term, location, maxPages = 2, limit = 25 }) {
  const base = 'https://www.yellowpages.com/search';
  const results = [];
  const seen = new Set();
  let blocked = false;
  for (let page = 1; page <= maxPages && results.length < limit; page++) {
    const url = `${base}?search_terms=${encodeURIComponent(term)}&geo_location_terms=${encodeURIComponent(location || '')}&page=${page}`;
    const { html, blocked: b } = await fetchPage(url);
    if (b) { blocked = true; break; }
    const listings = parseListings(html);
    if (!listings.length) break;
    for (const l of listings) {
      const key = l.business.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (key && !seen.has(key)) { seen.add(key); results.push(l); }
      if (results.length >= limit) break;
    }
    if (page < maxPages && results.length < limit) await sleep(1200);
  }
  return { results: results.slice(0, limit), blocked };
}

// ── Google Places API (Text Search v1) ───────────────────────────────────
async function searchPlaces({ term, location, limit = 25 }) {
  const textQuery = [term, location].filter(Boolean).join(' in ');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': config.placesApiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryTypeDisplayName,places.businessStatus',
    },
    body: JSON.stringify({ textQuery, pageSize: Math.min(20, limit) }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  const results = (json.places || [])
    .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
    .map((p) => ({
      business: p.displayName?.text || '',
      website: p.websiteUri || '',
      phone: p.nationalPhoneNumber || '',
      category: p.primaryTypeDisplayName?.text || '',
      address: p.formattedAddress || '',
      source: 'google-places',
    }))
    .filter((r) => r.business);
  return { results: results.slice(0, limit) };
}

export const placesConfigured = () => !!config.placesApiKey;

// Collect from one or all sources. Returns { results, blocked, ran } where
// `ran` lists which sources actually executed.
export async function collectLeads({ term, location, source = 'all', limit = 25 }) {
  if (!term) throw new Error('term is required');
  const want = source === 'all' ? ['places', 'yp'] : [source];
  const results = [];
  const ran = [];
  let blocked = false;

  for (const s of want) {
    if (s === 'places') {
      if (!placesConfigured()) continue; // silently skip when no key (yp still runs)
      ran.push('google-places');
      const { results: r } = await searchPlaces({ term, location, limit });
      results.push(...r);
    } else if (s === 'yp') {
      ran.push('yellowpages');
      const { results: r, blocked: b } = await searchYellowPages({ term, location, limit });
      blocked = blocked || b;
      results.push(...r);
    }
    if (results.length >= limit) break;
  }
  return { results: results.slice(0, limit), blocked, ran };
}
