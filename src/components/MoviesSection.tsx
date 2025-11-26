import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Calendar, Play, Clock, Plus } from "lucide-react";
import { useState } from "react";
import VideoModal from "@/components/VideoModal";

// Import movie posters
import vingadoresUltimatoPoster from "@/assets/posters/vingadores-ultimato.jpg";
import dunaParteDoisPoster from "@/assets/posters/duna-parte-dois.jpg";
import dunaParteDoisPosterWebP from "@/assets/posters/duna-parte-dois.webp";
import johnWick4Poster from "@/assets/posters/john-wick-4.jpg";
import oppenheimerPoster from "@/assets/posters/oppenheimer.jpg";
import oppenheimerPosterWebP from "@/assets/posters/oppenheimer.webp";
import spiderManNoWayHomePoster from "@/assets/posters/spider-man-no-way-home.jpg";
import spiderManNoWayHomePosterWebP from "@/assets/posters/spider-man-no-way-home.webp";
import topGunMaverickPoster from "@/assets/posters/top-gun-maverick.jpg";

// Import series posters
import successionPoster from "@/assets/posters/succession.jpg";
import successionPosterWebP from "@/assets/posters/succession.webp";
import theLastOfUsPoster from "@/assets/posters/the-last-of-us.jpg";
import theLastOfUsPosterWebP from "@/assets/posters/the-last-of-us.webp";
import houseOfTheDragonPoster from "@/assets/posters/house-of-the-dragon.jpg";
import houseOfTheDragonPosterWebP from "@/assets/posters/house-of-the-dragon.webp";
import strangerThingsPoster from "@/assets/posters/stranger-things.jpg";
import strangerThingsPosterWebP from "@/assets/posters/stranger-things.webp";

// Import trailers
import vingadoresUltimatoTrailer from "@/assets/trailers/vingadores-ultimato.mp4";
import johnWick4Trailer from "@/assets/trailers/john-wick-4.mp4";
import oppenheimerTrailer from "@/assets/trailers/oppenheimer.mp4";
import topGunMaverickTrailer from "@/assets/trailers/top-gun-maverick.mp4";

const MoviesSection = () => {
  const [selectedTrailer, setSelectedTrailer] = useState<{ src: string; title: string } | null>(null);
  const settings = {
    movies: {
      title: "Filmes e Séries",
      description: "Catálogo completo com os maiores sucessos",
      updateSchedule: {
        title: "Atualizações Semanais",
        days: ["Segunda", "Quarta", "Sexta"]
      }
    }
  };

  const featuredMovies = [
    {
      title: "Duna: Parte Dois",
      year: "2024",
      genre: "Ficção Científica",
      rating: "8.8",
      duration: "166 min",
      isNew: true,
      image: dunaParteDoisPoster,
      imageWebP: dunaParteDoisPosterWebP,
      trailer: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    },
    {
      title: "John Wick 4",
      year: "2023",
      genre: "Ação/Thriller",
      rating: "8.5",
      duration: "169 min",
      isNew: false,
      image: johnWick4Poster,
      imageWebP: undefined,
      trailer: johnWick4Trailer
    },
    {
      title: "Oppenheimer",
      year: "2023",
      genre: "Drama/História",
      rating: "9.0",
      duration: "180 min",
      isNew: false,
      image: oppenheimerPoster,
      imageWebP: oppenheimerPosterWebP,
      trailer: oppenheimerTrailer
    },
    {
      title: "Spider-Man: Sem Volta",
      year: "2023",
      genre: "Ação/Aventura",
      rating: "8.7",
      duration: "148 min",
      isNew: false,
      image: spiderManNoWayHomePoster,
      imageWebP: spiderManNoWayHomePosterWebP,
      trailer: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    }
  ];

  const popularSeries = [
    {
      title: "Succession",
      year: "2023",
      genre: "Drama",
      rating: "9.1",
      seasons: "4 temporadas",
      episodes: "39 episódios",
      image: successionPoster,
      imageWebP: successionPosterWebP
    },
    {
      title: "The Last of Us",
      year: "2023",
      genre: "Drama/Terror",
      rating: "8.8",
      seasons: "1 temporada",
      episodes: "9 episódios",
      image: theLastOfUsPoster,
      imageWebP: theLastOfUsPosterWebP
    },
    {
      title: "House of the Dragon",
      year: "2023",
      genre: "Fantasia/Drama",
      rating: "8.6",
      seasons: "1 temporada",
      episodes: "10 episódios",
      image: houseOfTheDragonPoster,
      imageWebP: houseOfTheDragonPosterWebP
    },
    {
      title: "Stranger Things",
      year: "2023",
      genre: "Ficção/Terror",
      rating: "8.9",
      seasons: "4 temporadas",
      episodes: "42 episódios",
      image: strangerThingsPoster,
      imageWebP: strangerThingsPosterWebP
    }
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-card">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16 px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
            <span className="text-gradient-accent">{settings.movies?.title?.split(' ')[0] || 'Filmes'}</span> e{" "}
            <span className="text-gradient-primary">{settings.movies?.title?.split(' ')[2] || 'séries'}</span> atualizados
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
            {settings.movies?.description || 'Catálogo atualizado semanalmente com os últimos lançamentos.'}
          </p>
        </div>

        {/* Featured Movies */}
        <div className="mb-10 sm:mb-12 lg:mb-16">
          <div className="mb-6 sm:mb-8 px-2 sm:px-4">
            <h3 className="text-2xl sm:text-3xl font-bold">🎬 Filmes em Destaque</h3>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredMovies.map((movie, index) => (
                <Card
                key={index}
                className="group bg-gradient-card border-2 border-border hover:border-primary/40 transition-smooth hover:scale-[1.02] hover:shadow-elevated cursor-pointer overflow-hidden h-full flex flex-col"
                onClick={() => setSelectedTrailer({ src: movie.trailer, title: movie.title })}
                role="button"
                aria-label={`${movie.title} - ${movie.year} - ${movie.rating} - ${movie.duration} - ${movie.genre} - Assistir trailer`}
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedTrailer({ src: movie.trailer, title: movie.title });
                  }
                }}
              >
                <div className="relative flex-shrink-0">
                  <picture>
                    {movie.imageWebP && <source srcSet={movie.imageWebP} type="image/webp" />}
                    <img
                      src={movie.image}
                      alt={`Pôster do filme ${movie.title} (${movie.year}) - ${movie.genre} - Avaliação ${movie.rating} estrelas - Duração ${movie.duration}`}
                      className="w-full h-64 sm:h-72 md:h-80 object-cover group-hover:scale-110 transition-smooth"
                      width="512"
                      height="768"
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-smooth flex items-center justify-center">
                    <Button
                      variant="hero"
                      size="icon"
                      className="h-10 w-10 sm:h-12 sm:w-12 opacity-0 group-hover:opacity-100 transition-smooth"
                      aria-label={`Reproduzir trailer de ${movie.title}`}
                    >
                      <Play className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 sm:space-y-3">
                    <h4 className="font-bold text-xs sm:text-sm leading-tight line-clamp-2 text-center min-h-[2rem] sm:min-h-[2.5rem] flex items-center justify-center">
                      {movie.title}
                    </h4>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">{movie.year}</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400" />
                          <span className="font-semibold">{movie.rating}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{movie.duration}</span>
                      </div>
                      <div className="flex justify-center">
                        <Badge variant="outline" className="text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5">
                          {movie.genre}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Popular Series */}
        <div className="mb-16">
          <div className="mb-8">
            <h3 className="text-3xl font-bold">📺 Séries Populares</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {popularSeries.map((series, index) => (
              <Card
                key={index}
                className="group bg-gradient-card border-2 border-border hover:border-primary/40 transition-smooth hover:scale-[1.02] hover:shadow-elevated cursor-pointer overflow-hidden h-full flex flex-col"
                role="button"
                aria-label={`${series.title} - ${series.year} - ${series.rating} - ${series.genre} - ${series.seasons} - ${series.episodes} - Ver informações`}
                tabIndex={0}
              >
                <div className="relative flex-shrink-0">
                  <picture>
                    {series.imageWebP && <source srcSet={series.imageWebP} type="image/webp" />}
                    <img
                      src={series.image}
                      alt={`Pôster da série ${series.title} (${series.year}) - ${series.genre} - Avaliação ${series.rating} estrelas - ${series.seasons} com ${series.episodes}`}
                      className="w-full h-80 object-cover group-hover:scale-110 transition-smooth"
                      width="512"
                      height="768"
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-smooth flex items-center justify-center">
                    <Button
                      variant="hero"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-smooth"
                      aria-label={`Reproduzir episódio de ${series.title}`}
                    >
                      <Play className="h-6 w-6" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm leading-tight line-clamp-2 text-center min-h-[2.5rem] flex items-center justify-center">
                      {series.title}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">{series.year}</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400" />
                          <span className="font-semibold">{series.rating}</span>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <Badge variant="outline" className="text-xs font-medium">
                          {series.genre}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1 text-center">
                        <div className="font-medium">{series.seasons}</div>
                        <div className="opacity-80">{series.episodes}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Update Schedule */}
        <div className="text-center bg-gradient-card p-8 rounded-xl border-2 border-border">
          <Calendar className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-4">Atualizações Semanais</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Nosso catálogo é atualizado toda segunda-feira com os últimos lançamentos do cinema e TV.
            Nunca perca um episódio ou filme.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              <span>Segundas: Filmes novos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-accent rounded-full"></div>
              <span>Quartas: Episódios de séries</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary-glow rounded-full"></div>
              <span>Sextas: Documentários</span>
            </div>
          </div>
        </div>

        {/* Video Modal */}
        {selectedTrailer && (
          <VideoModal
            isOpen={!!selectedTrailer}
            onClose={() => setSelectedTrailer(null)}
            videoSrc={selectedTrailer.src}
            title={selectedTrailer.title}
          />
        )}
      </div>
    </section>
  );
};

export default MoviesSection;