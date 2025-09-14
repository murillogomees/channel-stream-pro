import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import PlansSection from "@/components/PlansSection";
import ChannelsSection from "@/components/ChannelsSection";
import MoviesSection from "@/components/MoviesSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <section id="home">
          <HeroSection />
        </section>
        <section id="planos">
          <PlansSection />
        </section>
        <section id="canais">
          <ChannelsSection />
        </section>
        <section id="filmes">
          <MoviesSection />
        </section>
      </main>
    </div>
  );
};

export default Index;
