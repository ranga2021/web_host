import { Link } from 'react-router-dom';
import { site } from '../config/site';
import Container from './Container';

const socialDefs: Array<{ key: keyof NonNullable<typeof site.contact.socials>; label: string }> = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'Twitter' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export default function Footer() {
  const socials = site.contact.socials || {};
  const activeSocials = socialDefs.filter((s) => socials[s.key]);
  const year = new Date().getFullYear();
  const copyright =
    site.footer?.copyright || `© ${year} ${site.company.name}. All rights reserved.`;

  return (
    <footer className="mt-auto bg-primary text-[var(--color-primary-text)]">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="text-xl font-extrabold">{site.company.name}</div>
            {(site.footer?.tagline || site.company.tagline) && (
              <p className="mt-3 max-w-xs text-sm opacity-80">
                {site.footer?.tagline || site.company.tagline}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70">Explore</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/" className="opacity-90 hover:text-accent">Home</Link></li>
              <li><Link to="/about" className="opacity-90 hover:text-accent">About Us</Link></li>
              <li><Link to="/services" className="opacity-90 hover:text-accent">Services</Link></li>
              <li><Link to="/faqs" className="opacity-90 hover:text-accent">FAQs</Link></li>
              <li><Link to="/contact" className="opacity-90 hover:text-accent">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70">Get in touch</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {site.contact.phone && (
                <li>
                  <a href={`tel:${site.contact.phone.replace(/[^+\d]/g, '')}`} className="opacity-90 hover:text-accent">
                    {site.contact.phone}
                  </a>
                </li>
              )}
              {site.contact.email && (
                <li>
                  <a href={`mailto:${site.contact.email}`} className="opacity-90 hover:text-accent">
                    {site.contact.email}
                  </a>
                </li>
              )}
              {site.contact.address && <li className="opacity-90">{site.contact.address}</li>}
            </ul>

            {activeSocials.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-3">
                {activeSocials.map((s) => (
                  <a
                    key={s.key}
                    href={socials[s.key]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium opacity-90 hover:text-accent"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6 text-xs opacity-70">{copyright}</div>
      </Container>
    </footer>
  );
}
