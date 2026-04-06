import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Album {
  id: string;
  name: string;
  cover_image_url: string | null;
  songCount: number;
}

interface AlbumCarousel3DProps {
  albums: Album[];
}

export function AlbumCarousel3D({ albums }: AlbumCarousel3DProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalAlbums = albums.length;

  const getVisibleAlbums = useCallback(() => {
    const items: { album: Album; offset: number }[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      const idx = ((currentIndex + offset) % totalAlbums + totalAlbums) % totalAlbums;
      if (idx < totalAlbums) {
        items.push({ album: albums[idx], offset });
      }
    }
    return items;
  }, [currentIndex, albums, totalAlbums]);

  const goNext = () => setCurrentIndex((prev) => (prev + 1) % totalAlbums);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + totalAlbums) % totalAlbums);

  if (totalAlbums === 0) return null;

  const visibleAlbums = getVisibleAlbums();

  return (
    <div className="relative flex flex-col items-center py-6">
      {/* Clothesline / wire */}
      <div className="absolute top-6 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-muted-foreground/40 to-transparent z-0" />

      <div className="relative flex items-center justify-center w-full h-[340px] md:h-[380px]">
        {/* Prev button */}
        {totalAlbums > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-2 md:left-4 z-20 h-10 w-10 rounded-full bg-secondary/80 hover:bg-secondary border border-border flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* Hanging albums */}
        <div className="relative w-full max-w-2xl h-full flex items-center justify-center">
          <AnimatePresence mode="popLayout">
            {visibleAlbums.map(({ album, offset }) => {
              const absOffset = Math.abs(offset);
              const isCenter = offset === 0;
              const xShift = offset * 150;
              const opacity = isCenter ? 1 : absOffset === 1 ? 0.5 : 0.18;
              const scale = isCenter ? 1 : absOffset === 1 ? 0.78 : 0.6;
              const blur = isCenter ? 0 : absOffset === 1 ? 1.5 : 3;
              // Hanging swing angle — side cards tilt slightly
              const rotate = isCenter ? 0 : offset * 4;
              // String length varies for depth feel
              const stringLength = isCenter ? 30 : absOffset === 1 ? 20 : 12;

              return (
                <motion.div
                  key={album.id}
                  layout
                  initial={{ opacity: 0, scale: 0.5, y: -60 }}
                  animate={{
                    opacity,
                    scale,
                    x: xShift,
                    rotate,
                    y: 0,
                    filter: `blur(${blur}px)`,
                  }}
                  exit={{ opacity: 0, scale: 0.5, y: -40 }}
                  transition={{ type: "spring", stiffness: 180, damping: 22 }}
                  className="absolute flex flex-col items-center cursor-pointer"
                  style={{
                    zIndex: 10 - absOffset,
                    transformOrigin: "top center",
                  }}
                  onClick={() => {
                    if (isCenter) {
                      navigate(`/album/${album.id}`);
                    } else {
                      setCurrentIndex(albums.indexOf(album));
                    }
                  }}
                  whileHover={isCenter ? { scale: 1.05, rotate: 0 } : {}}
                >
                  {/* Pin / clip */}
                  <div className="relative flex flex-col items-center">
                    {/* String */}
                    <div
                      className="w-[1.5px] bg-muted-foreground/50"
                      style={{ height: `${stringLength}px` }}
                    />
                    {/* Clip circle */}
                    <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/60 bg-background -mt-0.5 mb-1 z-10" />
                  </div>

                  {/* Card */}
                  <div
                    className={`w-36 md:w-44 rounded-xl overflow-hidden bg-card border ${
                      isCenter
                        ? "border-primary/30 shadow-2xl shadow-primary/10"
                        : "border-border/50 shadow-lg"
                    } transition-shadow`}
                  >
                    <div className="aspect-square w-full overflow-hidden">
                      {album.cover_image_url ? (
                        <img
                          src={album.cover_image_url}
                          alt={album.name}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/30 to-accent/30" />
                      )}
                    </div>
                    <div className="p-2.5 text-center">
                      <p className="text-sm font-display font-semibold text-foreground truncate">
                        {album.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {album.songCount} song{album.songCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Next button */}
        {totalAlbums > 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 md:right-4 z-20 h-10 w-10 rounded-full bg-secondary/80 hover:bg-secondary border border-border flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}
      </div>

      {/* Dots indicator */}
      {totalAlbums > 3 && (
        <div className="flex gap-1.5 mt-2">
          {albums.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
