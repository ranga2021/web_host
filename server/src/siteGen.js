import { config } from './config.js';
import { normalizeConfig } from './tenantConfig.js';

// ── Automatic tenant-site generation ─────────────────────────────────────
//
// Ported from the bot (bot/src/enrich.js + ai.js + email.js) so the dashboard
// can generate a demo site synchronously when the admin clicks "Create demo"
// on a lead. Uses Claude when ANTHROPIC_API_KEY is set; otherwise falls back
// to a deterministic, fully-populated template built from the lead's details.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s) => EMAIL_RE.test(String(s || '').trim());

// "New South Wales — Sydney" → { state: 'New South Wales', city: 'Sydney' }
function parseRegion(raw) {
  if (!raw) return { state: '', city: '' };
  const m = String(raw).split(/[—–-]/).map((s) => s.trim()).filter(Boolean);
  if (m.length >= 2) return { state: m[0], city: m.slice(1).join(' ') };
  return { state: String(raw).trim(), city: '' };
}

// Map a stored lead row into the record shape the generator expects.
export function recFromLead(lead) {
  const { state, city } = parseRegion(lead.region);
  return {
    business: lead.business || '',
    category: lead.category || '',
    website: lead.website || '',
    email: (lead.email || '').trim(),
    phone: lead.phone || '',
    region: lead.region || '',
    state,
    city,
    size: '',
    linkedin: '',
  };
}

// ── Enrich: pull a little text from the business's real website ───────────
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
  } catch {
    return null;
  }
}

// ── Claude tool schema (mirrors SiteConfig / normalizeConfig) ─────────────
const SITE_CONFIG_TOOL = {
  name: 'emit_site_config',
  description: 'Return the website content for this business as a structured SiteConfig object.',
  input_schema: {
    type: 'object',
    required: ['company', 'colors', 'hero', 'products', 'about', 'faqs', 'meta'],
    properties: {
      company: { type: 'object', required: ['name', 'tagline'], properties: { name: { type: 'string' }, tagline: { type: 'string' } } },
      colors: {
        type: 'object', required: ['primary', 'accent'],
        properties: { primary: { type: 'string', description: 'CSS hex color' }, accent: { type: 'string', description: 'CSS hex color' }, primaryText: { type: 'string' } },
      },
      contact: {
        type: 'object',
        properties: { email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, socials: { type: 'object', properties: { facebook: { type: 'string' }, instagram: { type: 'string' }, linkedin: { type: 'string' } } } },
      },
      hero: {
        type: 'object', required: ['headline', 'subheadline', 'ctaLabel'],
        properties: { headline: { type: 'string' }, subheadline: { type: 'string' }, ctaLabel: { type: 'string' }, ctaHref: { type: 'string' } },
      },
      products: {
        type: 'array', description: 'Services offered (4–6).',
        items: { type: 'object', required: ['name', 'description'], properties: { name: { type: 'string' }, description: { type: 'string' } } },
      },
      testimonials: {
        type: 'array', description: 'EXACTLY 3 sample testimonials. Each quote MUST begin with "(Sample) ".',
        items: { type: 'object', required: ['quote', 'author'], properties: { quote: { type: 'string' }, author: { type: 'string' }, role: { type: 'string' }, rating: { type: 'integer' } } },
      },
      stats: {
        type: 'array', description: '3–4 headline stats.',
        items: { type: 'object', required: ['value', 'label'], properties: { value: { type: 'string' }, label: { type: 'string' } } },
      },
      about: {
        type: 'object', required: ['heading', 'body'],
        properties: { heading: { type: 'string' }, body: { type: 'string', description: '2–3 paragraphs separated by \\n\\n' } },
      },
      faqs: {
        type: 'array', description: '4–6 FAQs.',
        items: { type: 'object', required: ['q', 'a'], properties: { q: { type: 'string' }, a: { type: 'string' } } },
      },
      footer: { type: 'object', properties: { copyright: { type: 'string' }, tagline: { type: 'string' } } },
      meta: {
        type: 'object', required: ['title', 'description'],
        properties: { title: { type: 'string', description: 'SEO title ≤ 60 chars' }, description: { type: 'string', description: 'Meta description ≤ 155 chars' } },
      },
    },
  },
};

const SYSTEM = `You are a senior web copywriter and brand designer creating a polished marketing website for an Australian glass & glazing business. Write specific, professional, locally-relevant Australian English copy (no American spelling). Reflect the business's name, services, and city. Choose a tasteful, professional colour palette appropriate to the brand.

Hard rules:
- Testimonials are SAMPLES: produce exactly 3 and prefix every quote with "(Sample) ". Never invent named real customers as if real.
- Services (products) should be concrete glass/glazing offerings (e.g. shower screens, splashbacks, balustrades, glass repairs, mirrors, double glazing) matched to the business type.
- meta.title ≤ 60 chars, meta.description ≤ 155 chars, include the city for local SEO.
- Do not fabricate phone numbers or addresses; leave contact fields you don't know empty.
Call the emit_site_config tool with the result. Do not write prose.`;

function buildPrompt(rec, enrichment) {
  const lines = [
    `Business name: ${rec.business}`,
    rec.category && `Industry/category: ${rec.category}`,
    rec.city && `City: ${rec.city}`,
    rec.state && `State/region: ${rec.state}`,
    rec.website && `Existing website: ${rec.website}`,
  ].filter(Boolean);
  let block = lines.join('\n');
  if (enrichment) {
    block += `\n\n--- Extracted from their current website (for grounding; do not copy verbatim) ---\n`;
    if (enrichment.title) block += `Title: ${enrichment.title}\n`;
    if (enrichment.description) block += `Description: ${enrichment.description}\n`;
    if (enrichment.text) block += `Page text: ${enrichment.text}\n`;
  }
  return block;
}

// ── Deterministic fallback (no Claude key, or on API failure) ─────────────
function mockConfig(rec) {
  const name = rec.business || 'Glass Co';
  const city = rec.city || rec.region || 'Australia';
  const cat = (rec.category || 'Glass').replace(/^Glass\s*/i, '') || 'Glass';
  const palettes = [
    { primary: '#1e3a5f', accent: '#38bdf8' },
    { primary: '#0f766e', accent: '#f59e0b' },
    { primary: '#3730a3', accent: '#22d3ee' },
    { primary: '#7c2d12', accent: '#fbbf24' },
  ];
  const pal = palettes[name.length % palettes.length];
  const services = ['Shower Screens', 'Glass Splashbacks', 'Balustrades', 'Glass Repairs & Replacement', 'Mirrors', 'Double Glazing'];
  return {
    company: { name, tagline: `${city}'s trusted glass & glazing specialists` },
    colors: pal,
    contact: { email: rec.email || undefined, phone: rec.phone || undefined, address: city },
    hero: {
      headline: `Quality Glass & Glazing in ${city}`,
      subheadline: `${name} delivers expert ${cat.toLowerCase()} work for homes and businesses across ${city}. Fast quotes, clean finishes, fully insured.`,
      ctaLabel: 'Get a Free Quote',
      ctaHref: rec.email ? `mailto:${rec.email}` : '#contact',
    },
    products: services.slice(0, 5).map((s) => ({ name: s, description: `Professional ${s.toLowerCase()} — measured, supplied and installed by ${name}.` })),
    testimonials: [
      { quote: '(Sample) Fast, tidy and professional from quote to install. Highly recommend.', author: 'Sample Customer', role: `${city} homeowner`, rating: 5 },
      { quote: '(Sample) Great communication and the finish is flawless. Will use again.', author: 'Sample Customer', role: 'Local builder', rating: 5 },
      { quote: '(Sample) Competitive price and they turned up on time. Couldn’t fault it.', author: 'Sample Customer', role: 'Business owner', rating: 5 },
    ],
    stats: [
      { value: '15+', label: 'Years of experience' },
      { value: '2,000+', label: 'Jobs completed' },
      { value: '100%', label: 'Fully insured' },
      { value: '4.9★', label: 'Average rating' },
    ],
    about: {
      heading: `About ${name}`,
      body: `${name} is a ${city}-based glass and glazing company specialising in ${cat.toLowerCase()}.\n\nFrom shower screens and splashbacks to balustrades and emergency repairs, our experienced team delivers high-quality workmanship with a focus on safety, precision and reliability.\n\nWe service both residential and commercial clients across ${city} and surrounds.`,
    },
    faqs: [
      { q: 'Do you offer free quotes?', a: `Yes — ${name} provides free, no-obligation quotes across ${city}.` },
      { q: 'Are you insured and licensed?', a: 'Yes, we are fully insured and our installers are qualified to Australian standards.' },
      { q: 'How long does an installation take?', a: 'Most residential jobs are completed within a single visit once glass is measured and made.' },
      { q: 'Do you handle emergency glass repairs?', a: 'Yes, we offer prompt repair and board-up services for broken glass.' },
      { q: 'What areas do you service?', a: `We service ${city} and the surrounding region.` },
    ],
    footer: { copyright: `© ${name}`, tagline: `Glass & glazing in ${city}` },
    meta: {
      title: `${name} | Glass & Glazing ${city}`.slice(0, 60),
      description: `Expert glass & glazing in ${city} — shower screens, splashbacks, balustrades, repairs. Free quotes from ${name}.`.slice(0, 155),
    },
  };
}

export const claudeConfigured = () => !!config.anthropicApiKey;

// Generate a validated SiteConfig for a lead. Returns { config, usedClaude }.
export async function generateSiteConfig(rec, enrichment) {
  let rawConfig;
  let usedClaude = false;

  if (config.anthropicApiKey) {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: config.anthropicApiKey });
      const res = await client.messages.create({
        model: config.claudeModel,
        max_tokens: 4096,
        system: SYSTEM,
        tools: [SITE_CONFIG_TOOL],
        tool_choice: { type: 'tool', name: 'emit_site_config' },
        messages: [{ role: 'user', content: buildPrompt(rec, enrichment) }],
      });
      const toolUse = res.content.find((c) => c.type === 'tool_use');
      if (!toolUse) throw new Error('Claude did not return a tool_use block');
      rawConfig = toolUse.input;
      usedClaude = true;
    } catch (err) {
      // Never fail the demo over a Claude hiccup — fall back to the template.
      console.warn(`[siteGen] Claude generation failed, using fallback: ${err.message}`);
      rawConfig = mockConfig(rec);
    }
  } else {
    rawConfig = mockConfig(rec);
  }

  // Sheet is the source of truth for contact details.
  rawConfig.contact = rawConfig.contact || {};
  if (rec.email) rawConfig.contact.email = rec.email;
  if (rec.phone && !rawConfig.contact.phone) rawConfig.contact.phone = rec.phone;

  return { config: normalizeConfig(rawConfig), usedClaude };
}

// ── Email draft (mirrors bot/src/email.js) ────────────────────────────────
function greetingName(rec) {
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
