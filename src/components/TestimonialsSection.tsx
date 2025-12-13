import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Quote } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TestimonialsContent {
  title: string;
  subtitle: string;
}

const TestimonialsSection = () => {
  const [content, setContent] = useState<TestimonialsContent>({
    title: "O Que Nossos Clientes Dizem",
    subtitle: "Milhares de clientes satisfeitos em todo o Brasil"
  });

  useEffect(() => {
    const fetchContent = async () => {
      const { data } = await supabase
        .from('homepage_content')
        .select('content')
        .eq('section_key', 'testimonials')
        .single();
      if (data?.content && typeof data.content === 'object') {
        const contentData = data.content as Record<string, unknown>;
        setContent({
          title: (contentData.title as string) || content.title,
          subtitle: (contentData.subtitle as string) || content.subtitle,
        });
      }
    };
    fetchContent();
  }, []);

  const testimonials = [
    {
      name: "Carlos Mendes",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos",
      initials: "CM",
      location: "São Paulo, SP",
      rating: 5,
      text: "Melhor serviço de IPTV que já usei! Qualidade impecável, nunca trava e o suporte é muito rápido. Vale cada centavo do plano anual.",
      plan: "Plano Anual"
    },
    {
      name: "Marina Silva",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marina",
      initials: "MS",
      location: "Rio de Janeiro, RJ",
      rating: 5,
      text: "Adoro a variedade de canais! Tenho todos os canais de esporte, filmes e séries que queria. A instalação foi super fácil e o preço está ótimo.",
      plan: "Plano Semestral"
    },
    {
      name: "Roberto Costa",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Roberto",
      initials: "RC",
      location: "Brasília, DF",
      rating: 5,
      text: "Excelente custo-benefício! Cancelei minha TV por assinatura tradicional e não me arrependo. A qualidade 4K é fantástica.",
      plan: "Plano Trimestral"
    },
    {
      name: "Ana Paula",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ana",
      initials: "AP",
      location: "Curitiba, PR",
      rating: 5,
      text: "Perfeito para toda a família! Cada um assiste o que quer em dispositivos diferentes. O suporte 24/7 realmente funciona.",
      plan: "Plano Anual"
    },
    {
      name: "Fernando Oliveira",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fernando",
      initials: "FO",
      location: "Belo Horizonte, MG",
      rating: 5,
      text: "Fiz o teste grátis e já contratei no mesmo dia. Nunca vi tanta qualidade e estabilidade em IPTV. Recomendo demais!",
      plan: "Plano Mensal"
    },
    {
      name: "Juliana Santos",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Juliana",
      initials: "JS",
      location: "Porto Alegre, RS",
      rating: 5,
      text: "Já indiquei para vários amigos! O atendimento é excepcional e a economia comparada à TV a cabo é impressionante. Muito satisfeita!",
      plan: "Plano Semestral"
    }
  ];

  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < rating
            ? "fill-yellow-400 text-yellow-400"
            : "fill-muted text-muted"
        }`}
      />
    ));
  };

  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Quote className="h-8 w-8 text-primary" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              {content.title}
            </h2>
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {content.subtitle}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="bg-gradient-card border-2 border-border hover:border-primary/40 transition-all duration-300 hover:shadow-elevated animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 space-y-4">
                {/* Rating */}
                <div className="flex items-center gap-1">
                  {renderStars(testimonial.rating)}
                </div>

                {/* Quote */}
                <Quote className="h-8 w-8 text-primary/20" />
                
                {/* Text */}
                <p className="text-muted-foreground leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {testimonial.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.location}</div>
                    <div className="text-xs text-primary mt-1">{testimonial.plan}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8 mt-12 max-w-4xl mx-auto">
          <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="text-3xl font-bold text-primary mb-1">98%</div>
            <div className="text-sm text-muted-foreground">Satisfação</div>
          </div>
          <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="text-3xl font-bold text-primary mb-1">5.000+</div>
            <div className="text-sm text-muted-foreground">Clientes Ativos</div>
          </div>
          <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="text-3xl font-bold text-primary mb-1">24/7</div>
            <div className="text-sm text-muted-foreground">Suporte</div>
          </div>
          <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="text-3xl font-bold text-primary mb-1">99.9%</div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
