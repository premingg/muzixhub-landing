import { Play, Plus, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { toast } from "sonner";
import { useSongCover } from "@/hooks/useTelegramImage";

interface SongCardProps {
  song: Song;
  allSongs?: Song[];
}

export function SongCard({ song, allSongs }: SongCardProps) {
  const { playSong, addToQueue } = usePlayerStore();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const liked = isLiked(song.id);
  const coverUrl = useSongCover(song);

  const handlePlay = () => {
    playSong(song, allSongs || [song]);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(song);
    toast.success(`"${song.title}" added to queue`);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(song.id);
    toast.success(liked ? "Removed from liked songs" : "Added to liked songs");
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative bg-card hover:bg-secondary/80 rounded-xl p-3 transition-colors cursor-pointer"
      onClick={handlePlay}
    >
      <div className="relative aspect-square rounded-lg bg-secondary overflow-hidden mb-3">
        {coverUrl ? (
          <motion.img
            src={coverUrl}
            alt={song.title}
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.08 }}
            transition={{ duration: 0.4 }}
          />
        ) : (
          <div className="h-full w-full gradient-primary opacity-30 group-hover:opacity-50 transition-opacity" />
        )}
        {/* Like button - top right */}
        <motion.button
          onClick={handleLike}
          whileTap={{ scale: 1.4 }}
          className={`absolute top-2 right-2 h-7 w-7 rounded-full backdrop-blur-sm flex items-center justify-center transition-all ${
            liked
              ? "bg-primary/20 text-primary opacity-100"
              : "bg-secondary/80 text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? "fill-primary" : ""}`} />
        </motion.button>
        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button
            onClick={handleAddToQueue}
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.8 }}
            className="h-8 w-8 rounded-full bg-secondary/90 backdrop-blur-sm flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-foreground" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center glow-shadow"
          >
            <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
          </motion.button>
        </div>
      </div>
      <h3 className="text-sm font-medium truncate text-foreground">{song.title}</h3>
      <p
        className="text-xs text-muted-foreground truncate mt-0.5 hover:text-primary hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/artist/${encodeURIComponent(song.artist)}`);
        }}
      >
        {song.artist}
      </p>
    </motion.div>
  );
}
