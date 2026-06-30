import { site } from '../config/site';
import Container from '../components/Container';
import CtaLink from '../components/CtaLink';

export default function Contact() {
  const email = site.contact.email;
  const phone = site.contact.phone;
  const address = site.contact.address;

  const mailtoHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(
        `Quote request — ${site.company.name}`
      )}&body=${encodeURIComponent(
        'Hi,\n\nI would like a quote for the following glazing work:\n\n- \n\nMy name:\nBest contact number:\nSuburb:\n\nThanks!'
      )}`
    : undefined;

  return (
    <>
      <section className="bg-primary py-16 text-[var(--color-primary-text)]">
        <Container>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Contact Us</h1>
          <p className="mt-4 max-w-2xl text-lg opacity-90">
            Get in touch with {site.company.name} for a free, no-obligation quote.
          </p>
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              {phone && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-accent">Phone</h2>
                  <a
                    href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                    className="mt-1 block text-xl font-semibold text-primary hover:text-accent"
                  >
                    {phone}
                  </a>
                </div>
              )}
              {email && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-accent">Email</h2>
                  <a
                    href={`mailto:${email}`}
                    className="mt-1 block text-xl font-semibold text-primary hover:text-accent"
                  >
                    {email}
                  </a>
                </div>
              )}
              {address && (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-accent">Address</h2>
                  <p className="mt-1 text-xl font-semibold text-primary">{address}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-primary">Request a quote</h2>
              <p className="mt-3 text-slate-600">
                Tell us about your project and we'll get back to you, usually within one business
                day.
              </p>
              {mailtoHref ? (
                <CtaLink href={mailtoHref} variant="primary" className="mt-6">
                  Email us your enquiry
                </CtaLink>
              ) : (
                <p className="mt-6 text-slate-600">
                  Please call us to discuss your project.
                </p>
              )}
              {phone && (
                <p className="mt-4 text-sm text-slate-500">
                  Prefer to talk? Call{' '}
                  <a
                    href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                    className="font-semibold text-primary hover:text-accent"
                  >
                    {phone}
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
