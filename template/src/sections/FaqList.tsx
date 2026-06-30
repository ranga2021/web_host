import { site } from '../config/site';
import Container from '../components/Container';
import SectionHeading from '../components/SectionHeading';

export default function FaqList({
  limit,
  showHeading = true,
}: {
  limit?: number;
  showHeading?: boolean;
}) {
  const all = site.faqs || [];
  if (all.length === 0) return null;
  const items = typeof limit === 'number' ? all.slice(0, limit) : all;

  return (
    <section className="bg-slate-50 py-20">
      <Container>
        {showHeading && (
          <SectionHeading
            eyebrow="FAQs"
            title="Frequently asked questions"
            subtitle="Everything you need to know before booking your glazing job."
          />
        )}
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {items.map((f, i) => (
            <details
              key={i}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-primary">
                {f.q}
                <span className="ml-auto flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent/15 text-accent transition-transform group-open:rotate-45">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
