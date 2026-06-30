import Hero from '../sections/Hero';
import Stats from '../sections/Stats';
import Services from '../sections/Services';
import Testimonials from '../sections/Testimonials';
import FaqList from '../sections/FaqList';
import CtaBand from '../sections/CtaBand';

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Services limit={3} />
      <Testimonials />
      <FaqList limit={4} />
      <CtaBand />
    </>
  );
}
