import { config } from './config.js';

// ── Google Sheet → leads import ──────────────────────────────────────────
//
// Reads the sheet's PUBLIC CSV export (…/export?format=csv&gid=…). No Google
// credentials required as long as the sheet is shared "Anyone with the link
// can view". Rows are mapped onto the `leads` table shape and returned; the
// caller inserts them (deduped) exactly like collected leads.

// Minimal RFC-4180-ish CSV parser (handles quoted fields with commas/newlines).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Each lead field maps to the first header found from its candidate list
// (case-insensitive). Ordered specific → generic so a glass-industry sheet and
// a plain one both resolve. Unmatched fields are simply left blank.
const FIELD_HEADERS = {
  business: ['Glass Company Name', 'Business', 'Business Name', 'Company', 'Company Name', 'Name'],
  category: ['Company Type', 'Category', 'Type', 'Niche'],
  website:  ['Website Link', 'Website', 'Site', 'URL'],
  email:    ['Contact Email', 'Email', 'E-mail'],
  phone:    ['Phone', 'Phone Number', 'Telephone', 'Mobile'],
  address:  ['Address', 'Street Address', 'Location'],
  region:   ['States', 'State', 'Region', 'City', 'Area'],
};

export async function fetchSheetLeads({ sheetId = config.sheetId, gid = config.sheetGid } = {}) {
  if (!sheetId) throw new Error('No Google Sheet configured — set SHEET_ID in the server environment.');
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid || 0}`;

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    if ([401, 403, 404].includes(res.status)) {
      throw new Error(`Sheet not readable (HTTP ${res.status}). Share it as "Anyone with the link can view".`);
    }
    throw new Error(`Sheet fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  // A private sheet returns Google's HTML sign-in page instead of CSV.
  if (/^\s*</.test(text) || /<html/i.test(text.slice(0, 200))) {
    throw new Error('Sheet is not public — Google returned a sign-in page. Share it as "Anyone with the link can view".');
  }

  const grid = parseCsv(text);
  if (grid.length < 2) return [];

  const header = (grid[0] || []).map((h) => h.trim());
  const colOf = (candidates) => {
    for (const name of candidates) {
      const i = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const cols = Object.fromEntries(
    Object.entries(FIELD_HEADERS).map(([field, cands]) => [field, colOf(cands)]),
  );

  const leads = [];
  let carriedRegion = ''; // region cells are often set once then left blank below
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i] || [];
    const val = (field) => (cols[field] >= 0 ? (cells[cols[field]] ?? '').trim() : '');
    const region = val('region');
    if (region) carriedRegion = region;
    const business = val('business');
    if (!business) continue; // skip blank / separator rows
    leads.push({
      business,
      website: val('website'),
      email: val('email'),
      phone: val('phone'),
      address: val('address'),
      category: val('category'),
      region: region || carriedRegion,
      source: 'google-sheet',
    });
  }
  return leads;
}
