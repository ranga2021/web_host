const RESERVED = new Set([
  'admin', 'api', 'static', 'assets', 'login', 'logout', '_next', 'public', 'health',
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function validateSlug(slug) {
  if (typeof slug !== 'string') return 'slug must be a string';
  if (!SLUG_RE.test(slug)) {
    return 'slug must be 1–40 chars: lowercase letters, digits, hyphens (no leading/trailing hyphen)';
  }
  if (RESERVED.has(slug)) return `slug "${slug}" is reserved`;
  return null;
}

// Turn a business name into a valid base slug.
export function slugify(name) {
  let s = String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (!s) s = 'demo';
  if (RESERVED.has(s)) s = `${s}-demo`.slice(0, 40);
  return s;
}

// Produce a candidate, then -2, -3, … variants (used on slug collisions).
export function slugCandidate(base, attempt) {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, 40 - suffix.length).replace(/-+$/g, '')}${suffix}`;
}
