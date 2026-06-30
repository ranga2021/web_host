import { config, live } from './config.js';
import { log } from './log.js';
// Import the host tool's REAL validator so generated content is guaranteed to
// survive tenant creation unchanged (no surprise field-stripping at deploy).
import { normalizeConfig } from '../../server/src/tenantConfig.js';

// JSON Schema mirroring SiteConfig (server/src/tenantConfig.js). Claude is
// forced to call this tool, so its output is structurally valid by construction.
const SITE_CONFIG_TOOL = {
  name: 'emit_site_config',
  description: 'Return the website content for this business as a structured SiteConfig object.',
  input_schema: {
    type: 'object',
    required: ['company', 'colors', 'hero', 'products', 'about', 'faqs', 'meta'],
    properties: {
      company: {
        type: 'object',
        required: ['name', 'tagline'],
        properties: { name: { type: 'string' }, tagline: { type: 'string' } },
      },
      colors: {
        type: 'object',
        required: ['primary', 'accent'],
        properties: {
          primary: { type: 'string', description: 'CSS hex color, e.g. #1e3a5f' },
          accent: { type: 'string', description: 'CSS hex color' },
          primaryText: { type: 'string' },
        },
      },
      contact: {
        type: 'object',
        properties: {
          email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' },
          socials: { type: 'object', properties: { facebook: { type: 'string' }, instagram: { type: 'string' }, linkedin: { type: 'string' } } },
        },
      },
      hero: {
        type: 'object',
        required: ['headline', 'subheadline', 'ctaLabel'],
        properties: {
          headline: { type: 'string' }, subheadline: { type: 'string' },
          ctaLabel: { type: 'string' }, ctaHref: { type: 'string' },
        },
      },
      products: {
        type: 'array', description: 'Services offered (4–6).',
        items: {
          type: 'object', required: ['name', 'description'],
          properties: { name: { type: 'string' }, description: { type: 'string' } },
        },
      },
      testimonials: {
        type: 'array', description: 'EXACTLY 3 sample testimonials. Each quote MUST begin with "(Sample) ".',
        items: {
          type: 'object', required: ['quote', 'author'],
          properties: { quote: { type: 'string' }, author: { type: 'string' }, role: { type: 'string' }, rating: { type: 'integer' } },
        },
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

function buildPrompt(rec, enrichment) {
  const lines = [
    `Business name: ${rec.business}`,
    rec.category && `Industry/category: ${rec.category}`,
    rec.city && `City: ${rec.city}`,
    rec.state && `State/region: ${rec.state}`,
    rec.size && `Company size: ${rec.size}`,
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

const SYSTEM = `You are a senior web copywriter and brand designer creating a polished marketing website for an Australian glass & glazing business. Write specific, professional, locally-relevant Australian English copy (no American spelling). Reflect the business's name, services, and city. Choose a tasteful, professional colour palette appropriate to the brand.

Hard rules:
- Testimonials are SAMPLES: produce exactly 3 and prefix every quote with "(Sample) ". Never invent named real customers as if real.
- Services (products) should be concrete glass/glazing offerings (e.g. shower screens, splashbacks, balustrades, glass repairs, mirrors, double glazing) matched to the business type.
- meta.title ≤ 60 chars, meta.description ≤ 155 chars, include the city for local SEO.
- Do not fabricate phone numbers or addresses; leave contact fields you don't know empty.
Call the emit_site_config tool with the result. Do not write prose.`;

// ── Deterministic mock (dry-run / no key) ────────────────────────────────
function mockConfig(rec) {
  const name = rec.business || 'Glass Co';
  const city = rec.city || 'Australia';
  const cat = (rec.category || 'Glass').replace(/^Glass\s*/i, '') || 'Glass';
  // Deterministic palette from name length.
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
    contact: { email: rec.email || undefined, address: city, socials: rec.linkedin ? { linkedin: rec.linkedin } : undefined },
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

export async function generateSiteConfig(rec, enrichment) {
  let rawConfig;
  if (live.claude) {
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
    log.step(`claude generated content for "${rec.business}" (${res.usage?.output_tokens ?? '?'} out tokens)`);
  } else {
    rawConfig = mockConfig(rec);
    log.step(`mock content for "${rec.business}" (no Claude key / dry-run)`);
  }
  // Force email/linkedin from the sheet (source of truth) over anything the AI guessed.
  rawConfig.contact = rawConfig.contact || {};
  if (rec.email) rawConfig.contact.email = rec.email;
  if (rec.linkedin) rawConfig.contact.socials = { ...(rawConfig.contact.socials || {}), linkedin: rec.linkedin };

  // Validate through the host tool's own normalizer — this is what the server
  // will store, so we deploy exactly what we validated here.
  const cleaned = normalizeConfig(rawConfig);
  return { config: cleaned, raw: rawConfig };
}

export const _internal = { mockConfig, SITE_CONFIG_TOOL };
