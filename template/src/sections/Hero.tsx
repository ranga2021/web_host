import { site } from '../config/site';
import Container from '../components/Container';
import CtaLink from '../components/CtaLink';

export default function Hero() {
  const headline = site.hero.headline || `Welcome to ${site.company.name}`;
  const subheadline = site.hero.subheadline || site.company.tagline;
  const ctaLabel = site.hero.ctaLabel || 'Get a Free Quote';
  const ctaHref = site.hero.ctaHref || '/contact';

  return (
    <section className="relative overflow-hidden bg-primary text-[var(--color-primary-text)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-accent) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent opacity-20 blur-3xl" />

      <Container className="relative grid items-center gap-10 py-20 sm:py-28 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {site.company.tagline && (
            <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-accent">
              {site.company.tagline}
            </span>
          )}
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {headline}
          </h1>
          {subheadline && (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed opacity-90">{subheadline}</p>
          )}
          <div className="mt-9 flex flex-wrap gap-4">
            <CtaLink href={ctaHref} variant="accent">
              {ctaLabel}
            </CtaLink>
            <CtaLink
              href="/services"
              variant="outline"
              className="border-white/40 text-[var(--color-primary-text)] hover:bg-white hover:text-primary"
            >
              View Our Services
            </CtaLink>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=70"
              alt={`${site.company.name} glazing work`}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
