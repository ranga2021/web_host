import { config } from './config.js';

// The bot only DRAFTS the email now (subject + plain-text body). The draft is
// stored on the server's outreach row, where the admin can edit it and then
// approve → the SERVER sends it (and appends the address/unsubscribe footer).

// Derive a friendly first name from an email local-part when possible, else
// fall back to a neutral greeting. (We never have real owner names in the sheet.)
export function greetingName(rec) {
  const local = (rec.email || '').split('@')[0] || '';
  if (/^(info|sales|admin|enquiries|contact|hello|service|support|orders|mail|office)/i.test(local)) return null;
  const cleaned = local.replace(/[._\-0-9]+/g, ' ').trim();
  if (cleaned && cleaned.length <= 20 && /^[a-z ]+$/i.test(cleaned)) {
    return cleaned.split(' ')[0].replace(/^\w/, (c) => c.toUpperCase());
  }
  return null;
}

export function renderEmailDraft(rec, demoUrl) {
  const first = greetingName(rec);
  const greet = first ? `Hi ${first},` : `Hi ${rec.business} team,`;
  const city = rec.city ? ` in ${rec.city}` : '';
  const subject = `A complimentary website demo for ${rec.business}`;

  const body =
`${greet}

We put together a complimentary website concept specifically for ${rec.business}${city} — no charge and no obligation.

You can view it here:
${demoUrl}

It's a fully working demo we designed to show how ${rec.business} could look online. The testimonials shown are clearly marked as samples. If you like the direction, we'd love to tailor it further — your real photos, copy, colours and content.

Happy to hear any thoughts — just reply to this email.

Kind regards,
${config.senderName}${config.senderCompany ? `\n${config.senderCompany}` : ''}`;

  return { subject, body, to: rec.email };
}
