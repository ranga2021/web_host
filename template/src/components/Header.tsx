import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { site } from '../config/site';
import Container from './Container';

const nav = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/faqs', label: 'FAQs' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold transition-colors hover:text-accent ${
      isActive ? 'text-accent' : 'text-slate-700'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <Container className="flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          {site.company.logo ? (
            <img
              src={site.company.logo}
              alt={site.company.name}
              className="h-10 w-auto max-w-[200px] object-contain"
            />
          ) : (
            <span className="text-lg font-extrabold text-primary">{site.company.name}</span>
          )}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkCls}>
              {n.label}
            </NavLink>
          ))}
          {site.contact.phone && (
            <a
              href={`tel:${site.contact.phone.replace(/[^+\d]/g, '')}`}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-text)] transition-opacity hover:opacity-90"
            >
              {site.contact.phone}
            </a>
          )}
        </nav>

        <button
          type="button"
          aria-label="Toggle menu"
          className="inline-flex items-center justify-center rounded-md p-2 text-primary md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </Container>

      {open && (
        <div className="border-t border-slate-100 bg-white md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-base font-semibold ${
                    isActive ? 'bg-slate-50 text-accent' : 'text-slate-700'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {site.contact.phone && (
              <a
                href={`tel:${site.contact.phone.replace(/[^+\d]/g, '')}`}
                className="mt-2 rounded-lg bg-primary px-3 py-2.5 text-center text-base font-semibold text-[var(--color-primary-text)]"
              >
                Call {site.contact.phone}
              </a>
            )}
          </Container>
        </div>
      )}
    </header>
  );
}
