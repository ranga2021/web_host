import { site } from '../config/site';
import Container from '../components/Container';
import Services from '../sections/Services';
import CtaBand from '../sections/CtaBand';

export default function ServicesPage() {
  return (
    <>
      <section className="bg-primary py-16 text-[var(--color-primary-text)]">
        <Container>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Our Services</h1>
          <p className="mt-4 max-w-2xl text-lg opacity-90">
            The full range of glass & glazing solutions offered by {site.company.name}.
          </p>
        </Container>
      </section>

      <Services showHeading={false} />
      <CtaBand />
    </>
  );
}
