import { log } from './log.js';

// Best-effort: fetch the business's existing site and extract a little plain
// text to ground the AI copy ("authentic" content per the proposal). Never
// fatal — on any failure we just return null and the AI works from sheet data.
export async function enrichFromWebsite(url, { timeoutMs = 8000 } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; WebHostBot/1.0; +demo-generator)' },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) return null;
    const html = (await res.text()).slice(0, 400_000);

    const pick = (re) => (html.match(re)?.[1] || '').trim();
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    // Strip script/style, tags, collapse whitespace → first chunk of body text.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2500);

    if (!title && !desc && text.length < 50) return null;
    return { url, title, description: desc, text };
  } catch (e) {
    log.warn(`enrich failed for ${url}: ${e.message}`);
    return null;
  }
}
