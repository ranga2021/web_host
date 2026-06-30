import { log } from '../log.js';

// ── Yellow Pages (yellowpages.com) lead source ───────────────────────────
//
// Scrapes the public organic search results (name, website, phone, address,
// category) for a term+location. Deliberately polite: a real browser UA, a
// short delay between pages, a per-request timeout, and a small page cap.
//
// HTML scraping is inherently brittle — YP can change their markup or rate-
// limit at any time. On a parse miss we return what we got rather than throw,
// and the caller treats an empty result as "nothing to add this run".
//
// NOTE: yellowpages.com is the US directory. The AU directory
// (yellowpages.com.au) sits behind heavier bot protection — if you need AU
// leads, the Google Places source is the reliable route.

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

async function fetchPage(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (res.status === 403 || res.status === 429) {
      log.warn(`yellowpages: blocked (${res.status}) — backing off`);
      return null;
    }
    if (!res.ok) { log.warn(`yellowpages: ${res.status} for ${url}`); return null; }
    return await res.text();
  } catch (e) {
    log.warn(`yellowpages: fetch failed (${e.message})`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Split a results page into per-listing HTML chunks, then pull fields from each.
function parseListings(html) {
  if (!html) return [];
  // Each organic result block starts at `class="result"` / `class="srp-listing"`.
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
    const address = [street, locality].filter(Boolean).join(', ');
    out.push({ business, website, phone, category, address, source: 'yellowpages' });
  }
  return out;
}

export async function searchYellowPages({ term, location, maxPages = 3, limit = 25 }) {
  if (!term) throw new Error('yellowpages: --term is required');
  const base = 'https://www.yellowpages.com/search';
  const results = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages && results.length < limit; page++) {
    const url = `${base}?search_terms=${encodeURIComponent(term)}&geo_location_terms=${encodeURIComponent(location || '')}&page=${page}`;
    log.step(`yellowpages: page ${page} — ${term}${location ? ` @ ${location}` : ''}`);
    const html = await fetchPage(url);
    const listings = parseListings(html);
    if (!listings.length) { log.info(`yellowpages: page ${page} returned 0 listings — stopping`); break; }

    for (const l of listings) {
      const key = l.business.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (key && !seen.has(key)) { seen.add(key); results.push(l); }
      if (results.length >= limit) break;
    }
    if (page < maxPages && results.length < limit) await sleep(1500); // be polite
  }

  log.ok(`yellowpages: collected ${results.length} listing(s)`);
  return results.slice(0, limit);
}

export const _internal = { parseListings, decode };
