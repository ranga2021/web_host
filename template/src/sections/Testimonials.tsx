import { site } from '../config/site';
import Container from '../components/Container';
import SectionHeading from '../components/SectionHeading';

function Stars({ rating = 5 }: { rating?: number }) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5 text-accent" aria-label={`${r} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 20 20" fill={i < r ? 'currentColor' : 'none'} stroke="currentColor">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const items = site.testimonials || [];
  if (items.length === 0) return null;

  return (
    <section className="bg-white py-20">
      <Container>
        <SectionHeading
          eyebrow="Testimonials"
          title="What our customers say"
          subtitle="Real feedback from homeowners and businesses across Sydney."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((t, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-7 shadow-sm"
            >
              <Stars rating={t.rating} />
              <blockquote className="mt-4 flex-1 text-slate-700">"{t.quote}"</blockquote>
              {(t.author || t.company || t.role) && (
                <figcaption className="mt-5 text-sm">
                  {t.author && <span className="font-bold text-primary">{t.author}</span>}
                  {(t.role || t.company) && (
                    <span className="block text-slate-500">
                      {[t.role, t.company].filter(Boolean).join(', ')}
                    </span>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
