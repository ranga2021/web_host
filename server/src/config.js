import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// Load .env from a list of candidate paths, in priority order.
// Process env (runtime --env-add, docker -e, Dokploy passthrough) always wins —
// dotenv only sets variables that aren't already defined.
const candidates = [
  process.env.DOTENV_PATH,                            // explicit override
  path.resolve(process.cwd(), '.env'),                // cwd/.env (works when cwd = /app/server)
  '/app/server/.env',                                 // the place the Dockerfile bakes Dokploy's .env
  path.resolve(process.cwd(), '..', '.env'),          // project root .env (local dev)
].filter(Boolean);

const loaded = [];
for (const file of candidates) {
  if (fs.existsSync(file)) {
    const res = dotenv.config({ path: file, override: false });
    if (!res.error) loaded.push(file);
  }
}
console.log(
  loaded.length
    ? `[config] loaded .env from: ${loaded.join(', ')}`
    : `[config] no .env file found — using process.env only`,
);

function required(name) {
  const v = process.env[name];
  if (!v) {
    const seen = Object.keys(process.env)
      .filter((k) => !/^(PATH|HOME|HOSTNAME|PWD|SHLVL|TERM|_|LANG|LC_)/.test(k))
      .sort();
    console.error(`\n[config] Missing required env var: ${name}`);
    console.error(`[config] Env vars currently visible to the process:`);
    console.error(`[config]   ${seen.join(', ') || '(none non-system)'}`);
    console.error(`[config] dotenv searched: ${candidates.join(', ')}`);
    console.error(`[config] dotenv loaded:   ${loaded.length ? loaded.join(', ') : '(none)'}`);
    console.error(`[config] If "${name}" is missing, check Dokploy's Environment Settings panel saved AND the app was redeployed.\n`);
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: required('JWT_SECRET'),
  adminPasswordHash: required('ADMIN_PASSWORD_HASH'),
  demosDir: path.resolve(process.env.DEMOS_DIR || '/var/www/demos'),
  disabledDir: path.resolve(process.env.DISABLED_DIR || '/var/www/demos/.disabled'),
  workDir: path.resolve(process.env.WORK_DIR || '/var/lib/web-host-tool/work'),
  tenantsDir: path.resolve(process.env.TENANTS_DIR || '/data/tenants'),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:3001').replace(/\/$/, ''),
  dbPath: path.resolve(process.env.DB_PATH || './data.db'),
  buildConcurrency: Number(process.env.BUILD_CONCURRENCY || 1),

  // ---- Email (outreach send on approval + admin notifications) ----
  // All optional: with no RESEND_API_KEY the server runs dashboard-only
  // (emails are logged, not sent) so nothing breaks before you wire Resend.
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Demo <demo@example.com>',
  emailReplyTo: process.env.EMAIL_REPLY_TO || '',
  senderName: process.env.SENDER_NAME || 'The Team',
  senderCompany: process.env.SENDER_COMPANY || '',
  senderAddress: process.env.SENDER_ADDRESS || '',
  unsubscribeUrl: process.env.UNSUBSCRIBE_URL || '',
  // Where admin notification emails go (defaults to the reply-to address).
  adminEmail: process.env.ADMIN_EMAIL || process.env.EMAIL_REPLY_TO || '',

  // ---- Lead collection (the dashboard "Collect leads" button) ----
  // Google Places API key. Optional: without it the collector falls back to
  // the Yellow Pages scraper only (which Google/YP may rate-limit).
  placesApiKey: process.env.PLACES_API_KEY || '',

  // ---- Google Sheet import (the dashboard "Import from Google Sheet" button) ----
  // Reads the sheet's public CSV export — no credentials needed as long as the
  // sheet is shared "Anyone with the link can view".
  sheetId: process.env.SHEET_ID || '16ji6lTjhpsud4gQdVCD_UrJKqoWY4O13zt90Uv3ts3c',
  sheetGid: process.env.SHEET_GID || '0',

  // ---- Automatic demo generation (the Leads "Create demo" button) ----
  // With a key, site copy is written by Claude grounded on the lead's own
  // website. Without one, a deterministic template is used instead — the
  // button still works, just with generic copy.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
};
