import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { useLikedSongs } from "@/hooks/useLikedSongs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Play, ListPlus, Heart, Disc3, Plus, Share2, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

interface SongContextMenuProps {
  song: Song;
  triggerClassName?: string;
}

export function SongContextMenu({ song, triggerClassName = "" }: SongContextMenuProps) {
  const { user } = useAuthStore();
  const { isLiked, toggleLike } = useLikedSongs();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("playlists")
      .select("id, name")
      .eq("user_id", user.id)
      .then(({ data }) => setPlaylists(data || []));
  }, [user]);

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    usePlayerStore.getState().playNext(song);
    toast.success(`"${song.title}" will play next`);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    usePlayerStore.getState().addToQueue(song);
    toast.success(`"${song.title}" added to queue`);
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const liked = isLiked(song.id);
    toggleLike(song.id);
    toast.success(liked ? "Removed from liked songs" : "Added to liked songs");
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/song/${song.id}`;
    if (navigator.share) {
      navigator.share({ title: song.title, text: `${song.title} — ${song.artist}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Song link copied to clipboard");
    }
  };

  const handleGoToArtist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { showFullPlayer, toggleFullPlayer } = usePlayerStore.getState();
    if (showFullPlayer) toggleFullPlayer();
    navigate(`/artist/${encodeURIComponent(song.artist)}`);
  };

  const handleGoToAlbum = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!song.album) return;
    const { showFullPlayer, toggleFullPlayer } = usePlayerStore.getState();
    if (showFullPlayer) toggleFullPlayer();
    navigate(`/album/${encodeURIComponent(song.album)}`);
  };

  const handleAddToPlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    const { error } = await supabase.from("playlist_songs").insert({
      playlist_id: playlistId,
      song_id: song.id,
    });
    if (error) {
      if (error.code === "23505") toast.info("Song already in playlist");
      else toast.error("Failed to add to playlist");
    } else {
      toast.success("Added to playlist");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className={`text-muted-foreground hover:text-foreground transition-colors ${triggerClassName}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handlePlayNext}>
          <Play className="h-4 w-4 mr-2" />
          Play Next
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAddToQueue}>
          <Plus className="h-4 w-4 mr-2" />
          Add to Queue
        </DropdownMenuItem>
        {playlists.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
              <ListPlus className="h-4 w-4 mr-2" />
              Add to Playlist
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {playlists.map((pl) => (
                <DropdownMenuItem key={pl.id} onClick={(e) => handleAddToPlaylist(e as unknown as React.MouseEvent, pl.id)}>
                  {pl.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onClick={handleToggleLike}>
          <Heart className={`h-4 w-4 mr-2 ${isLiked(song.id) ? "fill-primary text-primary" : ""}`} />
          {isLiked(song.id) ? "Unlike Song" : "Like Song"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share Song
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGoToArtist}>
          <User className="h-4 w-4 mr-2" />
          Go to Artist
        </DropdownMenuItem>
        {song.album && (
          <DropdownMenuItem onClick={handleGoToAlbum}>
            <Disc3 className="h-4 w-4 mr-2" />
            Go to Album
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
