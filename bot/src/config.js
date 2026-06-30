import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const botRoot = path.resolve(__dirname, '..');

// Load bot/.env (does not override anything already in process.env).
const envPath = path.join(botRoot, '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const bool = (v, dflt) => (v == null || v === '' ? dflt : /^(1|true|yes|on)$/i.test(v));
// First non-flag arg is the subcommand: 'generate' (default) | 'sync'.
const command = argv.find((a) => !a.startsWith('--')) || 'generate';

export const config = {
  botRoot,
  command,
  dryRunDir: path.join(botRoot, '_dryrun'),

  // Run controls (CLI flags win over env)
  dailyLimit: Number(process.env.DAILY_LIMIT || 10),
  dryRun: flag('dry-run') || bool(process.env.DRY_RUN, false),
  enrich: flag('no-enrich') ? false : bool(process.env.ENRICH, true),
  onlyBusiness: argv.find((a) => a.startsWith('--only='))?.slice('--only='.length) || null,
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'https://demos.yourdomain.com').replace(/\/$/, ''),

  // Google Sheet
  sheetId: process.env.SHEET_ID || '16ji6lTjhpsud4gQdVCD_UrJKqoWY4O13zt90Uv3ts3c',
  sheetTab: process.env.SHEET_TAB || 'Sheet1',
  sheetGid: process.env.SHEET_GID || '0',
  googleCredentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  googleCredentialsJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',

  // Claude
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-4-8',

  // web_host
  hostBaseUrl: (process.env.HOST_BASE_URL || 'http://localhost:3001').replace(/\/$/, ''),
  hostAdminPassword: process.env.HOST_ADMIN_PASSWORD || '',
  templateSlug: process.env.TEMPLATE_SLUG || 'crystal-clear-glass',

  // Resend / email
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Demo <demo@example.com>',
  emailReplyTo: process.env.EMAIL_REPLY_TO || '',
  senderName: process.env.SENDER_NAME || 'The Team',
  senderCompany: process.env.SENDER_COMPANY || '',
  senderAddress: process.env.SENDER_ADDRESS || '',
  unsubscribeUrl: process.env.UNSUBSCRIBE_URL || '',
};

// Per-integration "is this live or mocked?" flags. Anything without creds is
// mocked, and any missing piece forces the whole run into safe (no external
// side-effect) mode unless the run is explicitly dry.
// Sending email now lives in the SERVER (on approval), not the bot. The bot
// only reads/writes the sheet, calls Claude, and talks to the host API.
export const live = {
  sheetsWrite: !config.dryRun && !!(config.googleCredentialsFile || config.googleCredentialsJson),
  claude: !config.dryRun && !!config.anthropicApiKey,
  host: !config.dryRun && !!config.hostAdminPassword,
};
