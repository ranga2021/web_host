import { queries } from './db.js';
import { config } from './config.js';
import { sendAdminEmail } from './mailer.js';

// Notification channel comes from a setting so it's adjustable in the UI.
// Values: 'email_dashboard' (default) | 'email' | 'dashboard'.
function channel() {
  return queries.getSetting.get('notify_channel')?.value || 'email_dashboard';
}
const wantsDashboard = (c) => c === 'email_dashboard' || c === 'dashboard';
const wantsEmail     = (c) => c === 'email_dashboard' || c === 'email';

const adminLink = (path) => `${config.publicBaseUrl}${path}`;

/**
 * Create a notification: stored for the in-dashboard feed and/or emailed to
 * the admin, per the configured channel. Best-effort — never throws into the
 * request path.
 */
export async function notify({ kind, title, body, link }) {
  const c = channel();
  try {
    if (wantsDashboard(c)) {
      queries.insertNotification.run({ kind, title, body: body || null, link: link || null });
    }
    if (wantsEmail(c)) {
      const url = link ? adminLink(link) : adminLink('/admin');
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 8px">${escape(title)}</h2>
        ${body ? `<p>${escape(body)}</p>` : ''}
        <p><a href="${url}">Open in dashboard →</a></p></div>`;
      await sendAdminEmail(`[Web Host] ${title}`, html);
    }
  } catch (e) {
    console.error('[notify] failed:', e.message);
  }
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
