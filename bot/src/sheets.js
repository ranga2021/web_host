import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config, live } from './config.js';
import { log } from './log.js';

// Columns the bot manages (appended to the right of the sheet if absent).
const MANAGED = ['Demo URL', 'Generated', 'Email Sent Date', 'Bot Status'];
const FLAG_COL = 'Pitching Email Send'; // existing column we flip to TRUE

// ── A1 helpers ──────────────────────────────────────────────────────────
function colLetter(index0) {
  let n = index0 + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// ── Minimal RFC-4180-ish CSV parser (handles quoted fields w/ commas+newlines)
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

// "New South Wales — Sydney" → { state: 'New South Wales', city: 'Sydney' }
function parseRegion(raw) {
  if (!raw) return { state: '', city: '' };
  const m = raw.split(/[—–-]/).map((s) => s.trim()).filter(Boolean);
  if (m.length >= 2) return { state: m[0], city: m.slice(1).join(' ') };
  return { state: raw.trim(), city: '' };
}

const isTrue = (v) => /^(true|yes|1|x|✓|done|sent)$/i.test(String(v || '').trim());

// Map a header row + a data row into a normalized record.
function toRecord(header, cells, rowNumber, carriedRegion) {
  const get = (name) => {
    const i = header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    return i >= 0 ? (cells[i] ?? '').trim() : '';
  };
  const rawRegion = get('States') || carriedRegion;
  const { state, city } = parseRegion(rawRegion);
  return {
    rowNumber,
    region: rawRegion,
    state, city,
    business: get('Glass Company Name'),
    category: get('Company Type'),
    size: get('Company Size'),
    hasWebsite: get('Do they have a website'),
    website: get('Website Link'),
    email: get('Contact Email'),
    linkedin: get('Linkedin Page'),
    pitchSent: isTrue(get(FLAG_COL)),
    botStatus: get('Bot Status'),
    demoUrl: get('Demo URL'),
  };
}

// ── LIVE backend (googleapis) ────────────────────────────────────────────
async function makeLiveBackend() {
  const { google } = await import('googleapis');
  let auth;
  if (config.googleCredentialsJson) {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(config.googleCredentialsJson),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: config.googleCredentialsFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  const sheets = google.sheets({ version: 'v4', auth });
  const tab = config.sheetTab;

  let header = [];

  async function readGrid() {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId, range: tab,
    });
    return res.data.values || [];
  }

  return {
    backend: 'google-sheets (live read+write)',
    async readBusinesses() {
      const grid = await readGrid();
      header = grid[0] || [];
      const out = [];
      let carried = '';
      for (let i = 1; i < grid.length; i++) {
        const cells = grid[i];
        const regionCell = (cells[0] ?? '').trim();
        if (regionCell) carried = regionCell;
        const rec = toRecord(header, cells, i + 1, carried);
        out.push(rec);
      }
      return out;
    },
    async ensureColumns() {
      const grid = await readGrid();
      header = grid[0] || [];
      const updates = [];
      for (const name of MANAGED) {
        if (!header.some((h) => h.trim().toLowerCase() === name.toLowerCase())) {
          const idx = header.length;
          header = [...header, name];
          updates.push({ range: `${tab}!${colLetter(idx)}1`, values: [[name]] });
        }
      }
      if (updates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: config.sheetId,
          requestBody: { valueInputOption: 'RAW', data: updates },
        });
        log.ok(`sheet: added columns ${updates.map((u) => u.values[0][0]).join(', ')}`);
      }
    },
    async writeResult(rowNumber, fields) {
      const colOf = (name) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
      const data = [];
      const set = (name, value) => {
        const c = colOf(name);
        if (c >= 0 && value != null) data.push({ range: `${tab}!${colLetter(c)}${rowNumber}`, values: [[value]] });
      };
      set('Demo URL', fields.demoUrl);
      set('Generated', fields.generated);
      set('Email Sent Date', fields.emailSentDate);
      set('Bot Status', fields.status);
      if (fields.flipPitch) set(FLAG_COL, 'TRUE');
      if (data.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: config.sheetId,
          requestBody: { valueInputOption: 'RAW', data },
        });
      }
    },
  };
}

// ── DRY backend (public CSV read, local write log) ────────────────────────
async function makeDryBackend() {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv&gid=${config.sheetGid}`;
  let header = [];
  return {
    backend: 'public CSV read + local write log (dry)',
    async readBusinesses() {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
      const grid = parseCsv(await res.text());
      header = grid[0] || [];
      const out = [];
      let carried = '';
      for (let i = 1; i < grid.length; i++) {
        const cells = grid[i];
        const regionCell = (cells[0] ?? '').trim();
        if (regionCell) carried = regionCell;
        out.push(toRecord(header, cells, i + 1, carried));
      }
      return out;
    },
    async ensureColumns() {
      // Pretend-append managed columns so dry write logs look realistic.
      for (const name of MANAGED) {
        if (!header.some((h) => h.trim().toLowerCase() === name.toLowerCase())) header.push(name);
      }
      log.info(`sheet (dry): would ensure columns: ${MANAGED.join(', ')}`);
    },
    async writeResult(rowNumber, fields) {
      await fsp.mkdir(config.dryRunDir, { recursive: true });
      const line = JSON.stringify({ rowNumber, ...fields }) + '\n';
      await fsp.appendFile(path.join(config.dryRunDir, 'sheet-writes.jsonl'), line);
    },
  };
}

export async function makeSheets() {
  const backend = live.sheetsWrite ? await makeLiveBackend() : await makeDryBackend();
  log.info(`sheets backend: ${backend.backend}`);
  return backend;
}

export const _internal = { parseCsv, parseRegion, toRecord, colLetter, MANAGED };
