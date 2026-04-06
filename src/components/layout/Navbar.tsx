import { Search, Flame, User, X, Music2, Disc3 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { useListeningStreak } from "@/hooks/useListeningStreak";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore, type Song } from "@/store/playerStore";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchResult {
  type: "song" | "artist" | "album";
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
}

function StreakBadge() {
  const { currentStreak, loading } = useListeningStreak();
  if (loading) return null;
  return (
    <div className="flex items-center gap-1.5 bg-secondary/80 rounded-full px-3 py-1.5 text-sm font-medium text-foreground">
      <Flame className="h-4 w-4 text-orange-500" />
      <span>{currentStreak}d</span>
    </div>
  );
}

function SearchDropdownSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-bold ${className}`}
      style={{
        background: "var(--gradient-primary)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      MuzixHub
    </span>
  );
}

export { BrandLogo };

export function Navbar() {
  const { profile, isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 1) {
      setResults([]);
      setShowDropdown(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const q = `%${query}%`;
    const [songsRes, artistsRes, albumsRes] = await Promise.all([
      supabase.from("songs").select("id, title, artist, cover_image_url, album").or(`title.ilike.${q},artist.ilike.${q}`).order("plays", { ascending: false }).limit(5),
      supabase.from("artists").select("id, name, image_url").ilike("name", q).limit(3),
      supabase.from("albums").select("id, name, artist, cover_image_url").ilike("name", q).limit(3),
    ]);
    const items: SearchResult[] = [];
    (artistsRes.data || []).forEach((a) => items.push({ type: "artist", id: a.id, title: a.name, subtitle: "Artist", image_url: a.image_url }));
    (albumsRes.data || []).forEach((a) => items.push({ type: "album", id: a.id, title: a.name, subtitle: a.artist, image_url: a.cover_image_url }));
    (songsRes.data || []).forEach((s) => items.push({ type: "song", id: s.id, title: s.title, subtitle: s.artist, image_url: s.cover_image_url }));
    setResults(items);
    setShowDropdown(items.length > 0 || query.length > 0);
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setResults([]);
      setShowDropdown(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => performSearch(searchQuery.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, performSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setShowDropdown(false);
    setSearchQuery("");
    if (result.type === "artist") navigate(`/artist/${encodeURIComponent(result.title)}`);
    else if (result.type === "album") navigate(`/album/${encodeURIComponent(result.title)}`);
    else if (result.type === "song") {
      navigate(`/search?q=${encodeURIComponent(result.title)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowDropdown(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setResults([]);
    setShowDropdown(false);
  };

  const renderDropdown = () => {
    if (!showDropdown) return null;
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
        {searchLoading ? (
          <SearchDropdownSkeleton />
        ) : results.length > 0 ? (
          <div className="py-1">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}-${i}`}
                onMouseDown={(e) => { e.preventDefault(); handleResultClick(r); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/80 active:bg-secondary transition-colors text-left min-h-[48px]"
              >
                <div className={`h-9 w-9 ${r.type === "artist" ? "rounded-full" : "rounded-lg"} bg-secondary overflow-hidden flex-shrink-0`}>
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary/20">
                      {r.type === "artist" ? <User className="h-4 w-4 text-muted-foreground" /> :
                       r.type === "album" ? <Disc3 className="h-4 w-4 text-muted-foreground" /> :
                       <Music2 className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 flex-shrink-0">{r.type}</span>
              </button>
            ))}
            {searchQuery.trim() && (
              <button
                onMouseDown={(e) => { e.preventDefault(); handleSubmit(e as any); }}
                className="w-full px-3 py-2.5 text-sm text-primary hover:bg-secondary/60 transition-colors text-left border-t border-border/50"
              >
                See all results for "{searchQuery.trim()}"
              </button>
            )}
          </div>
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results found</div>
        )}
      </div>
    );
  };

  return (
    <header
      className="h-14 md:h-16 border-b border-border glass sticky top-0 z-30 flex items-center justify-between px-4 md:px-6"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-2 md:hidden flex-1 min-w-0" ref={dropdownRef}>
        <BrandLogo className="text-lg flex-shrink-0" />
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 ml-2 relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={mobileInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
              placeholder="Search..."
              className="w-full bg-secondary rounded-full pl-8 pr-8 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {renderDropdown()}
        </form>
      </div>

      <div className="hidden md:block relative" ref={dropdownRef}>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
              placeholder="Search songs, artists, albums..."
              className="bg-secondary border-none rounded-full pl-10 pr-10 py-2 text-sm w-[280px] lg:w-[360px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </form>
        {renderDropdown()}
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {isAuthenticated && <StreakBadge />}
        {isAuthenticated ? (
          <Link to="/profile" className="flex items-center gap-2">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                {profile?.username?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </Link>
        ) : (
          <Link
            to="/login"
            className="gradient-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
