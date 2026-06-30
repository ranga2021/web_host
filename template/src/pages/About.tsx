import { site } from '../config/site';
import Container from '../components/Container';
import Stats from '../sections/Stats';
import CtaBand from '../sections/CtaBand';

export default function About() {
  const heading = site.about?.heading || `About ${site.company.name}`;
  const paragraphs = (site.about?.body || '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <section className="bg-primary py-16 text-[var(--color-primary-text)]">
        <Container>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{heading}</h1>
          {site.company.tagline && (
            <p className="mt-4 max-w-2xl text-lg opacity-90">{site.company.tagline}</p>
          )}
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              {paragraphs.length > 0 ? (
                paragraphs.map((p, i) => (
                  <p key={i} className="text-lg leading-relaxed text-slate-700">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-lg leading-relaxed text-slate-700">
                  {site.company.name} is your trusted local glass & glazing partner.
                </p>
              )}
            </div>
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1604709177225-055f99402ea3?auto=format&fit=crop&w=800&q=70"
                  alt={`${site.company.name} team at work`}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Stats />
      <CtaBand />
    </>
  );
}
