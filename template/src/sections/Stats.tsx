import { site } from '../config/site';
import Container from '../components/Container';

export default function Stats() {
  const stats = site.stats || [];
  if (stats.length === 0) return null;

  return (
    <section className="border-b border-slate-100 bg-white py-12">
      <Container>
        <dl className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <dt className="text-3xl font-extrabold text-primary sm:text-4xl">{s.value}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-500">{s.label}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
