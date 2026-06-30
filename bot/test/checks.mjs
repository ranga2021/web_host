// Offline verification — no secrets required.
// Forces dry-run so nothing external is mutated, then exercises the full
// pipeline against the LIVE sheet (read-only CSV) and the server's REAL
// normalizeConfig validator.
process.env.DRY_RUN = 'true';
process.env.ENRICH = 'false';        // skip network calls to each business site during tests
process.env.DAILY_LIMIT = '5';

let passed = 0, failed = 0;
function ok(name)        { passed++; console.log(`  ✓ ${name}`); }
function bad(name, msg)  { failed++; console.error(`  ✗ ${name} — ${msg}`); }
function assert(cond, name, msg) { cond ? ok(name) : bad(name, msg || 'assertion failed'); }

const { slugify, isValidSlug, slugCandidate } = await import('../src/slug.js');
const { makeSheets } = await import('../src/sheets.js');
const { generateSiteConfig } = await import('../src/ai.js');
const { greetingName, renderEmailDraft } = await import('../src/email.js');
const { normalizeConfig } = await import('../../server/src/tenantConfig.js');

console.log('\n1) Slug rules');
assert(slugify('ABC Plumbing') === 'abc-plumbing', 'basic slugify');
assert(slugify('A1 Frameless - Glazing & Frameless Glass').length <= 40, 'long name truncated to 40');
assert(isValidSlug(slugify('V&N Glass')), 'ampersand handled', slugify('V&N Glass'));
assert(isValidSlug(slugify("O'Brien Glass® Adelaide")), 'unicode/symbols stripped', slugify("O'Brien Glass® Adelaide"));
assert(slugCandidate('abc-plumbing', 2) === 'abc-plumbing-2', 'collision suffix');
assert(slugify('admin') === 'admin-demo', 'reserved word avoided');

console.log('\n2) CSV parse + region carry-down (live sheet, read-only)');
const sheets = await makeSheets();
const rows = await sheets.readBusinesses();
assert(rows.length > 50, 'read many rows from sheet', `got ${rows.length}`);
const perth = rows.find((r) => /Glass Processing Australia/i.test(r.business));
assert(perth && /Western Australia/i.test(perth.state), 'state carried down to Perth block', perth?.state);
assert(perth && perth.city === 'Perth', 'city parsed from region', perth?.city);
const withEmail = rows.filter((r) => r.business?.trim() && /@/.test(r.email));
assert(withEmail.length > 30, 'found businesses with emails', `${withEmail.length}`);
const quoted = rows.find((r) => /Envision Auto Worx/i.test(r.business));
assert(!!quoted, 'quoted field with comma parsed correctly', 'Envision row not found');

console.log('\n3) AI mock → server normalizeConfig (content survives deploy)');
const sample = rows.find((r) => r.business === 'Ezy Glide Shower Screens') || withEmail[0];
const { config: cfg } = await generateSiteConfig(sample, null);
assert(cfg.company?.name === sample.business, 'company name set');
assert(cfg.about?.heading && cfg.about?.body, 'about survives normalizeConfig');
assert(Array.isArray(cfg.faqs) && cfg.faqs.length >= 4, 'faqs survive normalizeConfig', JSON.stringify(cfg.faqs?.length));
assert(cfg.products?.length >= 4, 'services/products present');
assert(cfg.testimonials?.every((t) => t.quote.startsWith('(Sample)')), 'testimonials marked as sample');
assert(cfg.contact?.email === sample.email, 'email forced from sheet (source of truth)');
assert(cfg.meta?.title?.length <= 60, 'meta title within SEO length');
// Round-trip: normalizing an already-normalized config must be stable.
assert(JSON.stringify(normalizeConfig(cfg)) === JSON.stringify(cfg), 'normalizeConfig is idempotent on output');

console.log('\n4) Email draft rendering + personalization');
const named = greetingName({ email: 'wayne@wayglass.com.au', business: 'WayGlass' });
assert(named === 'Wayne', 'derives first name from personal email', named);
const role = greetingName({ email: 'sales@vnglass.com.au', business: 'V&N Glass' });
assert(role === null, 'role inbox → no fake first name', String(role));
const msg = renderEmailDraft(sample, 'https://demos.example.com/ezy-glide-shower-screens/');
assert(msg.subject.includes(sample.business), 'subject personalized');
assert(msg.body.includes('demos.example.com/ezy-glide-shower-screens'), 'demo link present in body');
assert(/sample/i.test(msg.body), 'sample disclaimer present');
assert(msg.to === sample.email, 'recipient set from sheet');

console.log('\n5) Full dry-run orchestration (live read → mock AI → dry deploy → dry email → write log)');
const { run } = await import('../src/orchestrator.js');
const results = await run();
assert(results.length > 0 && results.length <= 5, 'respected daily limit', `${results.length}`);
assert(results.every((r) => r.ok), 'all batch rows succeeded', JSON.stringify(results.filter((r) => !r.ok)));
assert(results.every((r) => isValidSlug(r.slug)), 'every deployed slug is valid');
const uniqueSlugs = new Set(results.map((r) => r.slug));
assert(uniqueSlugs.size === results.length, 'no duplicate slugs in batch');

console.log(`\n${failed === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 1 - 1 : 1);
