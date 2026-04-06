import { Play, Music2 } from "lucide-react";
import { motion } from "framer-motion";

interface PlaylistCardProps {
  title: string;
  songCount: number;
  description?: string;
}

export function PlaylistCard({ title, songCount, description }: PlaylistCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group relative bg-card hover:bg-secondary/80 rounded-xl p-3 transition-colors cursor-pointer"
    >
      <div className="relative aspect-square rounded-lg bg-secondary overflow-hidden mb-3 flex items-center justify-center">
        <Music2 className="h-10 w-10 text-muted-foreground/50" />
        <motion.button
          className="absolute bottom-2 right-2 h-10 w-10 rounded-full gradient-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity glow-shadow"
        >
          <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
        </motion.button>
      </div>
      <h3 className="text-sm font-medium truncate text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>}
      <p className="text-xs text-muted-foreground mt-1">{songCount} songs</p>
    </motion.div>
  );
}
