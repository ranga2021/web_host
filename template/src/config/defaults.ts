import type { SiteConfig } from './types';

export const defaults: SiteConfig = {
  company: {
    name: 'Crystal Clear Glass & Glazing',
    tagline: "Sydney's trusted glass & glazing specialists",
    // No default logo image: tenants rarely have one, and the deep-merge would
    // otherwise leak this template's logo onto every tenant. Empty → Header/
    // Footer fall back to a text wordmark of company.name (see Header.tsx).
    logo: '',
    favicon: '/favicon.svg',
  },
  colors: {
    primary: '#1e3a5f',
    accent: '#38bdf8',
    primaryText: '#ffffff',
  },
  contact: {
    email: 'hello@crystalclearglass.com.au',
    phone: '(02) 8123 4567',
    address: 'Unit 4, 28 Carter Street, Lidcombe NSW 2141',
    socials: {
      facebook: 'https://facebook.com/crystalclearglass',
      instagram: 'https://instagram.com/crystalclearglass',
      linkedin: 'https://linkedin.com/company/crystalclearglass',
    },
  },
  hero: {
    headline: 'Premium Glass & Glazing, Crafted for Sydney Homes & Businesses',
    subheadline:
      'From frameless shower screens to balustrades and emergency glass repairs, our licensed glaziers deliver flawless results with a lifetime workmanship guarantee.',
    ctaLabel: 'Get a Free Quote',
    ctaHref: '/contact',
  },
  products: [
    {
      name: 'Frameless Shower Screens',
      description:
        'Sleek, custom-fitted frameless and semi-frameless shower screens in toughened safety glass that transform any bathroom.',
      image:
        'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=800&q=70',
      price: 'From $650',
    },
    {
      name: 'Glass Splashbacks',
      description:
        'Heat-resistant kitchen and laundry splashbacks in any colour, printed or mirrored — easy to clean and built to last.',
      image:
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=70',
      price: 'From $480',
    },
    {
      name: 'Glass Balustrades',
      description:
        'Frameless and semi-frameless balustrades for stairs, balconies and pool fencing — fully compliant with AS 1288.',
      image:
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=70',
      price: 'From $890',
    },
    {
      name: 'Emergency Glass Repairs',
      description:
        'Fast 24/7 board-up and replacement for broken windows, shopfronts and doors — most jobs same day.',
      image:
        'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=70',
      price: 'Call for quote',
    },
    {
      name: 'Mirrors & Wardrobe Doors',
      description:
        'Made-to-measure mirrors, mirrored wardrobe doors and gym walls with polished or bevelled edges.',
      image:
        'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=70',
      price: 'From $260',
    },
    {
      name: 'Double Glazing',
      description:
        'Energy-efficient double glazed windows and doors that cut noise, slash power bills and improve comfort year round.',
      image:
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=70',
      price: 'From $1,200',
    },
  ],
  testimonials: [
    {
      quote:
        '(Sample) The team installed our frameless shower screen perfectly and on time. The finish is absolutely flawless and the bathroom looks twice the size now.',
      author: 'Sarah M.',
      role: 'Homeowner',
      company: 'Castle Hill',
      rating: 5,
    },
    {
      quote:
        '(Sample) Our shopfront window was smashed overnight and they had it boarded up within the hour and fully replaced the next morning. Lifesavers for our business.',
      author: 'David T.',
      role: 'Owner',
      company: 'Parramatta Cafe',
      rating: 5,
    },
    {
      quote:
        '(Sample) Professional from quote to install. The glass balustrade on our deck is stunning and passed inspection first time. Highly recommend.',
      author: 'Priya & James',
      role: 'Homeowners',
      company: 'Cronulla',
      rating: 5,
    },
  ],
  stats: [
    { value: '20+', label: 'Years in business' },
    { value: '8,500+', label: 'Jobs completed' },
    { value: '24/7', label: 'Emergency callout' },
    { value: '100%', label: 'Licensed & insured' },
  ],
  about: {
    heading: 'Sydney glaziers you can rely on',
    body: 'Crystal Clear Glass & Glazing has been serving homes and businesses across Greater Sydney for over two decades. What began as a small family workshop in Lidcombe has grown into one of the region\'s most trusted glazing teams — but our values have never changed: quality workmanship, honest pricing, and turning up when we say we will.\n\nEvery member of our team is fully licensed and insured, and we work exclusively with Australian-standard toughened and laminated safety glass. From a single splashback to a full commercial shopfront, we measure, manufacture and install with the same care and attention to detail.\n\nWe\'re proud to back every job with a lifetime workmanship guarantee. When you choose Crystal Clear, you\'re choosing a partner who stands behind the work long after the install is done.',
  },
  faqs: [
    {
      q: 'Do you offer free measure and quote?',
      a: 'Yes. We provide a free, no-obligation onsite measure and written quote for all glazing work across Greater Sydney. Most quotes are turned around within 24–48 hours.',
    },
    {
      q: 'Is your glass compliant with Australian Standards?',
      a: 'Absolutely. We use only Australian-standard toughened (Grade A) and laminated safety glass, and all balustrades, pool fencing and shower screens are installed to comply with AS 1288 and the relevant NCC requirements.',
    },
    {
      q: 'How quickly can you respond to an emergency glass repair?',
      a: 'Our 24/7 emergency team can typically attend within 1–2 hours for board-ups across the Sydney metro area, with most permanent replacements completed the same or next day.',
    },
    {
      q: 'Do you handle both residential and commercial work?',
      a: 'Yes. We work across both — from home shower screens, splashbacks and mirrors through to commercial shopfronts, office partitions and strata building glazing.',
    },
    {
      q: 'Are you licensed and insured?',
      a: 'We are fully licensed glaziers and carry comprehensive public liability insurance. Certificates are available on request, and every job is backed by our lifetime workmanship guarantee.',
    },
  ],
  footer: {
    copyright: '© ' + new Date().getFullYear() + ' Crystal Clear Glass & Glazing. All rights reserved.',
    tagline: 'Licensed Sydney glaziers — residential & commercial.',
  },
  meta: {
    title: 'Crystal Clear Glass & Glazing | Sydney Glass Specialists',
    description:
      'Sydney glass & glazing specialists. Frameless shower screens, splashbacks, balustrades, double glazing, mirrors and 24/7 emergency glass repairs. Free quotes.',
  },
};
