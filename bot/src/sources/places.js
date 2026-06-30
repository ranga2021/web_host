import { config } from '../config.js';
import { log } from '../log.js';

// ── Google Places API (Text Search, v1) lead source ──────────────────────
//
// The compliant, reliable way to pull business listings from Google Maps.
// Returns name, address, phone, website, rating, business status. Requires a
// PLACES_API_KEY (Google Cloud → enable "Places API (New)", add billing — a
// monthly free credit covers low volume).
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
//
// This source is inert until a key is set; collect.js skips it otherwise.

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = [
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'nextPageToken',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function searchPlaces({ term, location, limit = 25 }) {
  if (!config.placesApiKey) throw new Error('places: PLACES_API_KEY not set');
  if (!term) throw new Error('places: --term is required');

  const textQuery = [term, location].filter(Boolean).join(' in ');
  const results = [];
  let pageToken = null;

  for (let page = 1; page <= 3 && results.length < limit; page++) {
    const body = { textQuery, pageSize: Math.min(20, limit - results.length) };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': config.placesApiKey,
        'X-Goog-FieldMask': FIELDS,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`places: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();

    for (const p of json.places || []) {
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
      results.push({
        business: p.displayName?.text || '',
        website: p.websiteUri || '',
        phone: p.nationalPhoneNumber || '',
        category: p.primaryTypeDisplayName?.text || '',
        address: p.formattedAddress || '',
        source: 'google-places',
      });
      if (results.length >= limit) break;
    }

    pageToken = json.nextPageToken || null;
    if (!pageToken) break;
    await sleep(2000); // Places requires a short pause before a page token is valid
  }

  log.ok(`places: collected ${results.length} listing(s)`);
  return results.filter((r) => r.business).slice(0, limit);
}
