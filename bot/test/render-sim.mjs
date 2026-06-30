// Capstone: prove a bot-generated config + the built template produce a
// coherent tenant page — replicating demoServer.js's injection WITHOUT needing
// the SQLite server. Uses the server's own serializeForScript so the injection
// is byte-identical to production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeForScript } from '../../server/src/tenantConfig.js';
import { generateSiteConfig } from '../src/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.resolve(__dirname, '../../template/dist/index.html');

const templateSlug = 'crystal-clear-glass';
const tenantSlug = 'wayglass-shower-screens-and-balustrades';

let passed = 0, failed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };
const bad = (n, m) => { failed++; console.error(`  ✗ ${n} — ${m}`); };
const assert = (c, n, m) => (c ? ok(n) : bad(n, m));

if (!fs.existsSync(distIndex)) {
  console.error(`dist/index.html not found at ${distIndex} — build the template first.`);
  process.exit(1);
}
const html = fs.readFileSync(distIndex, 'utf8');

const rec = {
  business: 'WayGlass Shower Screens & Balustrades', city: 'Sydney', state: 'New South Wales',
  category: 'Glass Manufacturing', email: 'wayne@wayglass.com.au',
  linkedin: 'https://au.linkedin.com/in/glazefreak-138892288',
};
const { config: cfg } = await generateSiteConfig(rec, null);

// ── Replicate demoServer.transformHtmlForTenant (the parts that matter) ──
const base = `/${tenantSlug}/`;
const scriptTag = `<script>window.__BASE_URL__=${JSON.stringify(base)};window.__SITE__=${serializeForScript(cfg)};</script>`;
let out = /<head\b[^>]*>/i.test(html)
  ? html.replace(/<head\b[^>]*>/i, (m) => m + scriptTag)
  : scriptTag + html;
out = out.split(`/${templateSlug}/`).join(`/${tenantSlug}/`);  // rewriteSlugPaths

console.log('\nTemplate × bot-config render simulation');
assert(out.includes('window.__SITE__='), 'config injected into <head>');
assert(out.includes(serializeForScript(cfg).slice(0, 40)), 'injected payload matches generated config');
assert(out.includes('WayGlass Shower Screens'), 'tenant company name present in document');
assert(!out.includes(`/${templateSlug}/`), 'no leftover template-slug paths', 'found template slug refs');

const scriptSrcs = [...out.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
assert(scriptSrcs.length > 0, 'has bundled script tags', `${scriptSrcs.length}`);
assert(scriptSrcs.every((s) => s.startsWith(base) || /^https?:/.test(s)), 'every script src bound to tenant slug', scriptSrcs.join(', '));

const linkHrefs = [...out.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith('/'));
assert(linkHrefs.every((h) => h.startsWith(base)), 'every absolute link href bound to tenant slug', linkHrefs.join(', '));

// Write the rendered page so it can be eyeballed / served.
const outPath = path.join(__dirname, '..', '_dryrun', 'rendered-wayglass.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`\n  rendered tenant page → ${outPath}`);

console.log(`\n${failed === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
