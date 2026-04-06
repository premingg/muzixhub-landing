import { CoverImg } from "@/components/CoverImg";
import { motion, AnimatePresence } from "framer-motion";
import { X, GripVertical, Play, Trash2 } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import { useState } from "react";

export function QueuePanel() {
  const { queue, currentSong, showQueue, toggleQueue, playSong, removeFromQueue, reorderQueue } = usePlayerStore();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      reorderQueue(dragIndex, index);
      setDragIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <AnimatePresence>
      {showQueue && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={toggleQueue}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[340px] max-w-full bg-card border-l border-border z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display font-bold text-foreground">Queue</h3>
              <button onClick={toggleQueue} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide p-2">
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Queue is empty</p>
              ) : (
                queue.map((song, index) => (
                  <div
                    key={`${song.id}-${index}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
                      currentSong?.id === song.id ? "bg-primary/10" : "hover:bg-secondary/50"
                    } ${dragIndex === index ? "opacity-50" : ""}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                      {song.cover_image_url ? (
                        <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full gradient-primary opacity-30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <button
                      onClick={() => playSong(song, queue)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromQueue(index)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
