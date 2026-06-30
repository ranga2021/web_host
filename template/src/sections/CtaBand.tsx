import { site } from '../config/site';
import Container from '../components/Container';
import CtaLink from '../components/CtaLink';

export default function CtaBand() {
  const ctaLabel = site.hero.ctaLabel || 'Get a Free Quote';
  const ctaHref = site.hero.ctaHref || '/contact';

  return (
    <section className="bg-accent">
      <Container className="flex flex-col items-center gap-6 py-14 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="text-2xl font-extrabold text-primary sm:text-3xl">
            Ready to get started with {site.company.name}?
          </h2>
          <p className="mt-2 text-primary/80">
            Book your free, no-obligation measure and quote today.
          </p>
        </div>
        <div className="flex flex-none flex-wrap justify-center gap-3">
          <CtaLink href={ctaHref} variant="primary">
            {ctaLabel}
          </CtaLink>
          {site.contact.phone && (
            <CtaLink
              href={`tel:${site.contact.phone.replace(/[^+\d]/g, '')}`}
              variant="outline"
              className="border-primary text-primary"
            >
              Call {site.contact.phone}
            </CtaLink>
          )}
        </div>
      </Container>
    </section>
  );
}
