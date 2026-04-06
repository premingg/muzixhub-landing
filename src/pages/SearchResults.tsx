import { CoverImg } from "@/components/CoverImg";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/PageTransition";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { SongContextMenu } from "@/components/SongContextMenu";
import { Search, Music2, User, Clock, X, Disc3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Artist {
  id: string;
  name: string;
  image_url: string | null;
  bio: string | null;
}

interface Album {
  id: string;
  name: string;
  artist: string;
  cover_image_url: string | null;
}

const SEARCH_HISTORY_KEY = "muzixhub_search_history";
const MAX_HISTORY = 10;

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  } catch { return []; }
}

function addToSearchHistory(query: string) {
  if (!query.trim()) return;
  const history = getSearchHistory().filter((h) => h.toLowerCase() !== query.toLowerCase());
  history.unshift(query.trim());
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function removeFromHistory(query: string) {
  const history = getSearchHistory().filter((h) => h !== query);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(query);
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>(getSearchHistory());
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSongs([]);
      setArtists([]);
      setAlbums([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    addToSearchHistory(q);
    setHistory(getSearchHistory());
    const like = `%${q}%`;
    const [songsRes, artistsRes, albumsRes] = await Promise.all([
      supabase.from("songs").select("*").or(`title.ilike.${like},artist.ilike.${like},album.ilike.${like},genre.ilike.${like}`).order("plays", { ascending: false }).limit(50),
      supabase.from("artists").select("*").ilike("name", like).limit(10),
      supabase.from("albums").select("*").ilike("name", like).limit(10),
    ]);
    setSongs(songsRes.data || []);
    setArtists(artistsRes.data || []);
    setAlbums(albumsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim()) {
        setSearchParams({ q: val.trim() });
      } else {
        setSearchParams({});
      }
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim() });
    }
  };

  const handleHistoryClick = (h: string) => {
    setInputValue(h);
    setSearchParams({ q: h });
  };

  const handleRemoveHistory = (h: string) => {
    removeFromHistory(h);
    setHistory(getSearchHistory());
  };

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search songs, artists, albums..."
              autoFocus
              className="w-full bg-secondary rounded-full pl-12 pr-10 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
            {inputValue && (
              <button type="button" onClick={() => { setInputValue(""); setSearchParams({}); }} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </form>

        {!query && !loading && (
          <>
            {history.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Searches</h2>
                <div className="space-y-1">
                  {history.map((h) => (
                    <div
                      key={h}
                      className="flex items-center gap-3 p-2.5 rounded-lg active:bg-secondary/60 hover:bg-secondary/60 transition-colors cursor-pointer min-h-[44px]"
                      onClick={() => handleHistoryClick(h)}
                    >
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground flex-1">{h}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveHistory(h); }}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {history.length === 0 && (
              <p className="text-muted-foreground text-center py-12">Search for songs, artists, or albums</p>
            )}
          </>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : query ? (
          <>
            {artists.length > 0 && (
              <section>
                <h2 className="text-lg font-display font-semibold text-foreground mb-3">Artists</h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {artists.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 w-28 active:scale-95 transition-transform"
                      onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)}
                    >
                      <div className="h-20 w-20 rounded-full bg-secondary overflow-hidden">
                        {a.image_url ? (
                          <img src={a.image_url} alt={a.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary-foreground/50" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground text-center truncate w-full">{a.name}</p>
                      <p className="text-xs text-muted-foreground">Artist</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {albums.length > 0 && (
              <section>
                <h2 className="text-lg font-display font-semibold text-foreground mb-3">Albums</h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {albums.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 w-28 active:scale-95 transition-transform"
                      onClick={() => navigate(`/album/${encodeURIComponent(a.name)}`)}
                    >
                      <div className="h-20 w-20 rounded-xl bg-secondary overflow-hidden">
                        {a.cover_image_url ? (
                          <CoverImg src={a.cover_image_url} alt={a.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full gradient-primary opacity-40 flex items-center justify-center">
                            <Disc3 className="h-8 w-8 text-primary-foreground/50" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground text-center truncate w-full">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate w-full text-center">{a.artist}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {songs.length > 0 ? (
              <section>
                <h2 className="text-lg font-display font-semibold text-foreground mb-3">Songs</h2>
                <div className="space-y-0.5">
                  {songs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-2 rounded-lg active:bg-secondary/60 hover:bg-secondary/60 transition-colors cursor-pointer min-h-[56px]"
                      onClick={() => usePlayerStore.getState().playSong(s, songs)}
                    >
                      <div className="h-11 w-11 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                        {s.cover_image_url ? (
                          <CoverImg src={s.cover_image_url} alt={s.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full gradient-primary opacity-30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                        <p
                          className="text-xs text-muted-foreground truncate hover:text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/artist/${encodeURIComponent(s.artist)}`);
                          }}
                        >
                          {s.artist}
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <SongContextMenu song={s} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : artists.length === 0 && albums.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No results found for "{query}"</p>
            ) : null}
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
