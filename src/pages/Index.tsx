import { lazy, Suspense } from "react";

// Lazy load components for better performance
const Navigation = lazy(() => import("@/components/Navigation"));
const HeroSection = lazy(() => import("@/components/HeroSection"));
const DevicesSection = lazy(() => import("@/components/DevicesSection"));
const PlansSection = lazy(() => import("@/components/PlansSection"));
const ChannelsSection = lazy(() => import("@/components/ChannelsSection"));
const MoviesSection = lazy(() => import("@/components/MoviesSection"));
const ContactSection = lazy(() => import("@/components/ContactSection"));
const Footer = lazy(() => import("@/components/Footer"));
const FloatingButtons = lazy(() => import("@/components/FloatingButtons"));

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="h-16 bg-background" />}>
        <Navigation />
      </Suspense>
      <main>
        <section id="home">
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <HeroSection />
          </Suspense>
        </section>
        <section id="dispositivos">
          <Suspense fallback={<div className="py-20 bg-background" />}>
            <DevicesSection />
          </Suspense>
        </section>
        <section id="planos">
          <Suspense fallback={<div className="py-20 bg-background" />}>
            <PlansSection />
          </Suspense>
        </section>
        <section id="canais">
          <Suspense fallback={<div className="py-20 bg-background" />}>
            <ChannelsSection />
          </Suspense>
        </section>
        <section id="filmes">
          <Suspense fallback={<div className="py-20 bg-background" />}>
            <MoviesSection />
          </Suspense>
        </section>
        <section id="contato">
          <Suspense fallback={<div className="py-20 bg-background" />}>
            <ContactSection />
          </Suspense>
        </section>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
      <Suspense fallback={null}>
        <FloatingButtons />
      </Suspense>
    </div>
  );
};

export default Index;
