import Container from '../components/Container';
import FaqList from '../sections/FaqList';
import CtaBand from '../sections/CtaBand';

export default function Faqs() {
  return (
    <>
      <section className="bg-primary py-16 text-[var(--color-primary-text)]">
        <Container>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 max-w-2xl text-lg opacity-90">
            Answers to the questions we hear most often.
          </p>
        </Container>
      </section>

      <FaqList showHeading={false} />
      <CtaBand />
    </>
  );
}
