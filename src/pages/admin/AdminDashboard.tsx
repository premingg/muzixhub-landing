import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music, Users, PlayCircle, Disc3, Mic2 } from "lucide-react";

interface Stats {
  totalSongs: number;
  totalUsers: number;
  totalPlays: number;
  totalAlbums: number;
  totalArtists: number;
}

interface TopSong {
  title: string;
  artist: string;
  plays: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalSongs: 0, totalUsers: 0, totalPlays: 0, totalAlbums: 0, totalArtists: 0 });
  const [topSongs, setTopSongs] = useState<TopSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [songsRes, profilesRes, albumsRes, artistsRes] = await Promise.all([
        supabase.from("songs").select("*"),
        supabase.from("profiles").select("id"),
        supabase.from("albums").select("id", { count: "exact", head: true }),
        supabase.from("artists").select("id", { count: "exact", head: true }),
      ]);

      const songs = songsRes.data || [];
      const totalPlays = songs.reduce((acc, s) => acc + (s.plays || 0), 0);

      setStats({
        totalSongs: songs.length,
        totalUsers: profilesRes.data?.length || 0,
        totalPlays,
        totalAlbums: albumsRes.count || 0,
        totalArtists: artistsRes.count || 0,
      });

      setTopSongs(
        songs
          .sort((a, b) => (b.plays || 0) - (a.plays || 0))
          .slice(0, 7)
          .map((s) => ({ title: s.title, artist: s.artist, plays: s.plays || 0 }))
      );

      setLoading(false);
    }
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Songs", value: stats.totalSongs, icon: Music, color: "from-primary to-accent" },
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "from-accent to-primary" },
    { label: "Total Plays", value: stats.totalPlays, icon: PlayCircle, color: "from-primary to-accent" },
    { label: "Albums", value: stats.totalAlbums, icon: Disc3, color: "from-accent to-primary" },
    { label: "Artists", value: stats.totalArtists, icon: Mic2, color: "from-primary to-accent" },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{card.value.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Top Songs */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="font-display font-bold text-foreground mb-4">Top Songs by Plays</h3>
        {topSongs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No songs uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {topSongs.map((song, i) => (
              <div key={song.title} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{song.title}</p>
                    <p className="text-xs text-muted-foreground">{song.artist}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{song.plays.toLocaleString()} plays</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
