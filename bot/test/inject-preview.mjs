// Inject a bot-generated tenant config into the built template's index.html
// (keeping the /crystal-clear-glass/ base so `vite preview` serves assets),
// so we can screenshot a real generated site. Restore with --restore.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeForScript } from '../../server/src/tenantConfig.js';
import { generateSiteConfig } from '../src/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.resolve(__dirname, '../../template/dist/index.html');
const backup = distIndex + '.orig';

if (process.argv.includes('--restore')) {
  if (fs.existsSync(backup)) { fs.copyFileSync(backup, distIndex); fs.rmSync(backup); console.log('restored'); }
  process.exit(0);
}

if (!fs.existsSync(backup)) fs.copyFileSync(distIndex, backup);
const html = fs.readFileSync(backup, 'utf8');

const rec = {
  business: 'WayGlass Shower Screens & Balustrades', city: 'Sydney', state: 'New South Wales',
  category: 'Glass Manufacturing', email: 'wayne@wayglass.com.au',
};
const { config: cfg } = await generateSiteConfig(rec, null);
const scriptTag = `<script>window.__BASE_URL__="/";window.__SITE__=${serializeForScript(cfg)};</script>`;
const out = html.replace(/<head\b[^>]*>/i, (m) => m + scriptTag);
fs.writeFileSync(distIndex, out);
console.log(`injected "${cfg.company.name}" (primary ${cfg.colors.primary})`);
