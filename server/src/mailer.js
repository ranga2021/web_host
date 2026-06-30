import { config } from './config.js';

// Lazy Resend client (the package is optional until you wire email).
let _resend = null;
async function client() {
  if (!config.resendApiKey) return null;
  if (_resend) return _resend;
  const { Resend } = await import('resend');
  _resend = new Resend(config.resendApiKey);
  return _resend;
}

export function emailConfigured() {
  return !!config.resendApiKey;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Turn the editable plain-text body into a simple HTML email: escape, linkify
// bare URLs, convert newlines to <br>, append the compliance footer.
function bodyToHtml(body) {
  const linked = escapeHtml(body).replace(
    /(https?:\/\/[^\s<]+)/g,
    (u) => `<a href="${u}">${u}</a>`,
  ).replace(/\n/g, '<br>');
  const footer = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="font-size:12px;color:#9ca3af">${escapeHtml(config.senderAddress || '')}<br>
    ${config.unsubscribeUrl ? `Prefer not to receive these? <a href="${escapeHtml(config.unsubscribeUrl)}" style="color:#9ca3af">Unsubscribe</a>.` : ''}</p>`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.6">
    <div>${linked}</div>${footer}</div>`;
}

// Send a (possibly admin-edited) outreach email. Returns { id } or throws.
// With no Resend key it logs and returns a stub so dev/dashboard-only works.
export async function sendOutreach({ to, subject, body }) {
  const text = `${body}\n\n—\n${config.senderAddress || ''}\n${config.unsubscribeUrl ? `Unsubscribe: ${config.unsubscribeUrl}` : ''}`;
  const c = await client();
  if (!c) {
    console.log(`[mailer] (no RESEND_API_KEY) would send to ${to}: "${subject}"`);
    return { id: 'unsent-no-key', simulated: true };
  }
  const { data, error } = await c.emails.send({
    from: config.emailFrom,
    to,
    replyTo: config.emailReplyTo || undefined,
    subject,
    html: bodyToHtml(body),
    text,
    headers: config.unsubscribeUrl ? { 'List-Unsubscribe': `<${config.unsubscribeUrl}>` } : undefined,
  });
  if (error) throw new Error(`resend error: ${JSON.stringify(error)}`);
  return { id: data?.id };
}

// Send a plain admin notification email (best-effort; never throws).
export async function sendAdminEmail(subject, html) {
  try {
    const c = await client();
    if (!c || !config.adminEmail) {
      console.log(`[mailer] (notify, not emailed) ${subject}`);
      return;
    }
    await c.emails.send({ from: config.emailFrom, to: config.adminEmail, subject, html });
  } catch (e) {
    console.error('[mailer] admin email failed:', e.message);
  }
}
