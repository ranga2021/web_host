import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'accent' | 'outline';
};

const base =
  'inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

const variants: Record<NonNullable<Props['variant']>, string> = {
  primary: 'bg-primary text-[var(--color-primary-text)] hover:opacity-90',
  accent: 'bg-accent text-primary hover:opacity-90',
  outline: 'border-2 border-current text-primary hover:bg-primary hover:text-[var(--color-primary-text)]',
};

// Treats anything that isn't an internal route ("/...") as an external/protocol link.
function isInternal(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export default function CtaLink({ href, children, className = '', variant = 'accent' }: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (isInternal(href)) {
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
