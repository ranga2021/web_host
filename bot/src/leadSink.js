import { config, live } from './config.js';
import { log } from './log.js';

// Minimal web_host client used by `collect` to push gathered leads into the
// host DB (so they appear in the admin Leads page). Kept separate from host.js
// on purpose: collecting leads must work even before any template exists, so
// we deliberately skip the template lookup that makeLiveHost() requires.
export async function makeLeadSink() {
  if (!live.host) {
    return {
      backend: 'dry lead sink (no HOST_ADMIN_PASSWORD)',
      async push(records) { log.info(`(dry) would push ${records.length} lead(s) to the host`); return { inserted: 0, skipped: records.length }; },
    };
  }

  const base = config.hostBaseUrl;
  let cookie = '';
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: config.hostAdminPassword }),
  });
  if (!res.ok) throw new Error(`host login failed: ${res.status} ${await res.text()}`);
  const setCookie = (res.headers.getSetCookie?.() || [res.headers.get('set-cookie')]).filter(Boolean);
  cookie = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('wht_session=')) || '';
  if (!cookie) throw new Error('host login: no wht_session cookie returned');

  return {
    backend: `web_host live @ ${base}`,
    async push(records) {
      const r = await fetch(`${base}/api/leads/bulk`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ leads: records }),
      });
      const text = await r.text();
      let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
      if (r.status !== 201 && r.status !== 200) throw new Error(`leads/bulk failed (${r.status}): ${JSON.stringify(json)}`);
      return json; // { inserted, skipped, counts }
    },
  };
}
