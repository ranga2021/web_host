// Mirror of the host tool's slug rules (server/src/slug.js): 1–40 chars,
// lowercase letters/digits/hyphens, no leading/trailing hyphen, not reserved.
const RESERVED = new Set([
  'admin', 'api', 'static', 'assets', 'login', 'logout', '_next', 'public', 'health',
]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function slugify(name) {
  let s = String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')   // non-alnum → hyphen
    .replace(/^-+|-+$/g, '')        // trim hyphens
    .slice(0, 40)
    .replace(/-+$/g, '');           // re-trim after slice
  if (!s) s = 'demo';
  if (RESERVED.has(s)) s = `${s}-demo`.slice(0, 40);
  return s;
}

export function isValidSlug(slug) {
  return SLUG_RE.test(slug) && !RESERVED.has(slug);
}

// Produce a candidate, then -2, -3, … variants (used on slug collisions).
export function slugCandidate(base, attempt) {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, 40 - suffix.length).replace(/-+$/g, '')}${suffix}`;
}
