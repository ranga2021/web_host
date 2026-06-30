import { site } from '../config/site';
import type { Product } from '../config/types';
import Container from '../components/Container';
import SectionHeading from '../components/SectionHeading';

function ServiceCard({ p }: { p: Product }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-lg">
      {p.image && (
        <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-primary">{p.name}</h3>
          {p.price && (
            <span className="whitespace-nowrap rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-primary">
              {p.price}
            </span>
          )}
        </div>
        {p.description && <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{p.description}</p>}
        {p.href && (
          <a href={p.href} className="mt-4 text-sm font-semibold text-accent hover:underline">
            Learn more →
          </a>
        )}
      </div>
    </div>
  );
}

export default function Services({
  limit,
  showHeading = true,
}: {
  limit?: number;
  showHeading?: boolean;
}) {
  const all = site.products || [];
  if (all.length === 0) return null;
  const items = typeof limit === 'number' ? all.slice(0, limit) : all;

  return (
    <section className="bg-slate-50 py-20">
      <Container>
        {showHeading && (
          <SectionHeading
            eyebrow="What we do"
            title="Our glass & glazing services"
            subtitle={`Quality workmanship from ${site.company.name}, backed by a lifetime guarantee.`}
          />
        )}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, i) => (
            <ServiceCard key={i} p={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
