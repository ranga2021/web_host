export type Testimonial = {
  quote: string;
  author?: string;
  role?: string;
  company?: string;
  rating?: number;
};

export type Stat = {
  value: string;
  label: string;
};

export type Product = {
  name: string;
  description?: string;
  image?: string;
  href?: string;
  price?: string;
};

export type Faq = {
  q: string;
  a: string;
};

export type SiteConfig = {
  company: {
    name: string;
    tagline?: string;
    logo: string; // image URL (absolute or tenant-uploaded)
    favicon?: string; // favicon URL — host tool rewrites <link rel="icon">
  };
  colors: {
    primary: string; // any CSS color
    accent: string;
    primaryText?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    address?: string;
    socials?: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      twitter?: string;
      whatsapp?: string;
      youtube?: string;
      tiktok?: string;
    };
  };
  hero: {
    headline?: string;
    subheadline?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  products?: Product[]; // used as SERVICES
  testimonials?: Testimonial[];
  stats?: Stat[];
  about?: {
    heading?: string;
    body?: string; // body may contain multiple paragraphs separated by \n\n
  };
  faqs?: Faq[];
  footer?: {
    copyright?: string;
    tagline?: string;
  };
  meta?: {
    title?: string;
    description?: string;
  };
};
