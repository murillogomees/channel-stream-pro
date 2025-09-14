import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, Film, Trophy, Globe, Heart, Gamepad2, Music, GraduationCap } from "lucide-react";

const ChannelsSection = () => {
  const channelCategories = [
    {
      name: "Esportes",
      icon: Trophy,
      count: "150+",
      color: "text-red-400",
      bgColor: "bg-red-400/10",
      channels: [
        "ESPN", "ESPN Brasil", "SporTV", "SporTV 2", "SporTV 3",
        "Premiere", "Premiere 2", "Fox Sports", "Band Sports", "Combate"
      ]
    },
    {
      name: "Filmes & Séries",
      icon: Film,
      count: "200+",
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      channels: [
        "HBO", "HBO 2", "HBO Plus", "Telecine Premium", "Telecine Action",
        "Telecine Pipoca", "Warner Channel", "Sony Channel", "Universal TV", "AXN"
      ]
    },
    {
      name: "Entretenimento",
      icon: Tv,
      count: "300+",
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      channels: [
        "Globo", "SBT", "Record", "Band", "RedeTV",
        "Comedy Central", "TLC", "Discovery Channel", "History Channel", "National Geographic"
      ]
    },
    {
      name: "Internacionais",
      icon: Globe,
      count: "500+",
      color: "text-green-400",
      bgColor: "bg-green-400/10",
      channels: [
        "CNN International", "BBC World", "Fox News", "DW", "France 24",
        "RAI", "TVE", "RTP", "TV5 Monde", "NHK World"
      ]
    },
    {
      name: "Infantil",
      icon: Heart,
      count: "80+",
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
      channels: [
        "Cartoon Network", "Disney Channel", "Disney Junior", "Nickelodeon", "Discovery Kids",
        "Gloob", "SBT Kids", "TV Rá Tim Bum", "Baby TV", "Boomerang"
      ]
    },
    {
      name: "Games & Tech",
      icon: Gamepad2,
      count: "40+",
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
      channels: [
        "SporTV Games", "Loading", "Twitch Streamers", "YouTube Gaming", "ESports TV",
        "Game Show", "Tech Review", "Innovation TV", "Digital World", "Cyber Sports"
      ]
    },
    {
      name: "Música",
      icon: Music,
      count: "60+",
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
      channels: [
        "MTV", "Music Box", "VH1", "BIS", "Multishow",
        "CMT", "Country Music TV", "Rock TV", "Pop Music", "Classical Music"
      ]
    },
    {
      name: "Educação",
      icon: GraduationCap,
      count: "70+",
      color: "text-indigo-400",
      bgColor: "bg-indigo-400/10",
      channels: [
        "Discovery Science", "Animal Planet", "National Geographic", "History", "Discovery",
        "Travel Channel", "Food Network", "HGTV", "Investigation Discovery", "Science Channel"
      ]
    }
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-card to-background">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Mais de{" "}
            <span className="text-gradient-primary">10.000 canais</span>{" "}
            disponíveis
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Entretenimento para toda família. Esportes, filmes, séries, desenhos,
            documentários e muito mais, tudo em alta qualidade.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {channelCategories.map((category, index) => {
            const IconComponent = category.icon;
            return (
              <Card
                key={index}
                className="bg-gradient-card border-2 border-border hover:border-primary/40 transition-smooth hover:scale-[1.02] hover:shadow-card group"
              >
                <CardContent className="p-6 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className={`p-4 rounded-full ${category.bgColor} group-hover:scale-110 transition-smooth`}>
                      <IconComponent className={`h-8 w-8 ${category.color}`} />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold mb-2">{category.name}</h3>
                    <Badge variant="secondary" className="text-sm font-semibold">
                      {category.count} canais
                    </Badge>
                  </div>

                  {/* Channel Examples */}
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Exemplos:</div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {category.channels.slice(0, 6).map((channel, channelIndex) => (
                        <Badge
                          key={channelIndex}
                          variant="outline"
                          className="text-xs px-2 py-1"
                        >
                          {channel}
                        </Badge>
                      ))}
                      {category.channels.length > 6 && (
                        <Badge variant="outline" className="text-xs px-2 py-1">
                          +{category.channels.length - 6}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          {[
            { title: "Full HD & 4K", desc: "Qualidade de cinema" },
            { title: "EPG Completo", desc: "Guia de programação" },
            { title: "Sem Travamentos", desc: "Streaming estável" },
            { title: "Multi Idiomas", desc: "Legendas e dublagem" },
          ].map((feature, index) => (
            <div key={index} className="bg-gradient-card p-6 rounded-lg border border-border">
              <h4 className="font-bold text-primary mb-2">{feature.title}</h4>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ChannelsSection;