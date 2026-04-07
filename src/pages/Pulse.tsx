import { CoverImg } from "@/components/CoverImg";
import { useState, useEffect, useCallback, useRef } from "react";
import { Zap, Users, Plus, LogIn, Copy, X, Play, Pause, SkipForward, Music, Crown, Search, Trash2, ListMusic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { usePlayerStore, type Song } from "@/store/playerStore";

interface PulseSession {
  id: string;
  name: string;
  code: string;
  created_by: string;
  current_song_id: string | null;
  current_song_data: Song | null;
  is_playing: boolean;
  current_position: number;
  position_updated_at: string;
  queue: Song[];
  member_count: number;
  created_at: string;
}

type BroadcastEvent =
  | { type: 'play'; position: number; actioner: string; actionerId: string }
  | { type: 'pause'; position: number; actioner: string; actionerId: string }
  | { type: 'seek'; position: number; actioner: string; actionerId: string }
  | { type: 'song_change'; song: Song; actioner: string; actionerId: string }
  | { type: 'queue_update'; queue: Song[]; actioner: string; actionerId: string }
  | { type: 'skip'; song: Song; actioner: string; actionerId: string }
  | { type: 'session_end'; actioner: string; actionerId: string }
  | { type: 'heartbeat'; member_count: number };

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const pulseTable = () => supabase.from("pulse_sessions" as any) as any;

export default function Pulse() {
  const { user, profile } = useAuthStore();
  const displayName = profile?.username || user?.email?.split("@")[0] || "Someone";

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [activeSession, setActiveSession] = useState<PulseSession | null>(null);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [roomQueue, setRoomQueue] = useState<Song[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerMode, setPickerMode] = useState<"play" | "queue">("play");

  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dbChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCreator = activeSession?.created_by === user?.id;

  const sendBroadcast = useCallback((event: BroadcastEvent) => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'pulse_event',
      payload: event,
    });
  }, []);

  const loadSongs = async () => {
    const { data } = await supabase.from("songs").select("*").order("title");
    setSongs(data || []);
  };

  const cleanupAndLeave = useCallback(() => {
    if (broadcastChannelRef.current) {
      supabase.removeChannel(broadcastChannelRef.current);
      broadcastChannelRef.current = null;
    }
    if (dbChannelRef.current) {
      supabase.removeChannel(dbChannelRef.current);
      dbChannelRef.current = null;
    }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    setActiveSession(null);
    setActiveSong(null);
    setRoomQueue([]);
  }, []);

  const subscribeToSession = useCallback((sessionId: string) => {
    // Broadcast channel for instant events
    const bc = supabase.channel(`pulse-broadcast-${sessionId}`)
      .on('broadcast', { event: 'pulse_event' }, ({ payload }) => {
        const event = payload as BroadcastEvent;
        
        // Skip events we sent ourselves (use actionerId to identify)
        if ('actionerId' in event && event.actionerId === user?.id) {
          return;
        }
        
        const player = usePlayerStore.getState();

        switch (event.type) {
          case 'song_change':
          case 'skip':
            player.playSong(event.song);
            setActiveSong(event.song);
            setActiveSession(prev => prev ? { ...prev, is_playing: true, current_song_data: event.song, current_position: 0 } : null);
            toast(`${event.actioner} is playing "${event.song.title}" 🎵`, { duration: 3000 });
            break;
          case 'play':
            if (!player.isPlaying) player.togglePlay();
            setTimeout(() => player.seekTo(event.position), 100);
            setActiveSession(prev => prev ? { ...prev, is_playing: true, current_position: event.position } : null);
            toast(`${event.actioner} resumed ▶️`, { duration: 2000 });
            break;
          case 'pause':
            if (player.isPlaying) player.togglePlay();
            player.seekTo(event.position);
            setActiveSession(prev => prev ? { ...prev, is_playing: false, current_position: event.position } : null);
            toast(`${event.actioner} paused ⏸`, { duration: 2000 });
            break;
          case 'seek':
            player.seekTo(event.position);
            setActiveSession(prev => prev ? { ...prev, current_position: event.position } : null);
            break;
          case 'queue_update':
            setRoomQueue(event.queue);
            setActiveSession(prev => prev ? { ...prev, queue: event.queue } : null);
            break;
          case 'session_end':
            toast.error('The Pulse session has ended');
            cleanupAndLeave();
            break;
        }
      })
      .subscribe();

    broadcastChannelRef.current = bc;

    // DB channel for late-joiner sync
    const dc = supabase.channel(`pulse-db-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'pulse_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setActiveSession(prev => prev ? { ...prev, ...updated, current_song_data: updated.current_song_data as Song | null, queue: (updated.queue || []) as Song[] } : null);
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'pulse_sessions',
        filter: `id=eq.${sessionId}`,
      }, () => {
        toast.info("Pulse session ended");
        cleanupAndLeave();
      })
      .subscribe();

    dbChannelRef.current = dc;
  }, [cleanupAndLeave, user?.id]);

  // Create session
  const handleCreate = async () => {
    if (!user) { toast.error("Please sign in"); return; }
    if (!sessionName.trim()) { toast.error("Enter a session name"); return; }

    const code = generateRoomCode();
    const { data, error } = await pulseTable()
      .insert({ name: sessionName.trim(), code, created_by: user.id })
      .select()
      .single();

    if (error) { toast.error(error.message); return; }

    const session: PulseSession = {
      ...data,
      current_song_data: null,
      queue: [],
    };

    setActiveSession(session);
    setShowCreate(false);
    setSessionName("");
    loadSongs();
    subscribeToSession(data.id);
    toast.success(`Pulse created! Code: ${data.code}`);
  };

  // Join session
  const handleJoin = async () => {
    if (!user) { toast.error("Please sign in"); return; }
    if (joinCode.length < 4) { toast.error("Enter a valid code"); return; }

    const { data: raw, error } = await pulseTable()
      .select("*")
      .eq("code", joinCode.toUpperCase())
      .single();

    if (error || !raw) { toast.error("Session not found"); return; }

    // Increment member count
    await pulseTable().update({ member_count: (raw.member_count || 1) + 1 }).eq("id", raw.id);

    const session: PulseSession = {
      ...raw,
      member_count: (raw.member_count || 1) + 1,
      current_song_data: raw.current_song_data as Song | null,
      queue: (raw.queue || []) as Song[],
    };

    setActiveSession(session);
    setRoomQueue(session.queue);
    setShowJoin(false);
    setJoinCode("");
    loadSongs();
    subscribeToSession(raw.id);

    // Sync playback
    if (session.current_song_data) {
      setActiveSong(session.current_song_data);
      const player = usePlayerStore.getState();
      player.playSong(session.current_song_data);

      if (session.is_playing) {
        const elapsed = (Date.now() - new Date(session.position_updated_at).getTime()) / 1000;
        const actualPosition = session.current_position + elapsed;
        setTimeout(() => player.seekTo(actualPosition), 300);
      } else {
        setTimeout(() => {
          player.seekTo(session.current_position);
          if (player.isPlaying) player.togglePlay();
        }, 300);
      }
    }

    toast.success(`Joined "${session.name}"!`);
  };

  // Play song
  const playSongInPulse = useCallback(async (song: Song) => {
    if (!activeSession) return;

    await pulseTable().update({
      current_song_data: song as any,
      current_song_id: song.id,
      is_playing: true,
      current_position: 0,
      position_updated_at: new Date().toISOString(),
    }).eq("id", activeSession.id);

    sendBroadcast({ type: 'song_change', song, actioner: displayName, actionerId: user?.id || '' });
    usePlayerStore.getState().playSong(song);
    setActiveSong(song);
    setActiveSession(prev => prev ? { ...prev, current_song_data: song, current_song_id: song.id, is_playing: true, current_position: 0 } : null);
    setShowSongPicker(false);
    setSearchQuery("");
  }, [activeSession, sendBroadcast, displayName, user?.id]);

  // Toggle play/pause
  const togglePlayInPulse = useCallback(async () => {
    if (!activeSession) return;
    const newIsPlaying = !activeSession.is_playing;
    const currentPos = usePlayerStore.getState().progress;

    await pulseTable().update({
      is_playing: newIsPlaying,
      current_position: currentPos,
      position_updated_at: new Date().toISOString(),
    }).eq("id", activeSession.id);

    sendBroadcast({
      type: newIsPlaying ? 'play' : 'pause',
      position: currentPos,
      actioner: displayName,
      actionerId: user?.id || '',
    });
    usePlayerStore.getState().togglePlay();
    setActiveSession(prev => prev ? { ...prev, is_playing: newIsPlaying, current_position: currentPos } : null);
  }, [activeSession, sendBroadcast, displayName, user?.id]);

  // Skip
  const skipInPulse = useCallback(async () => {
    if (!activeSession || roomQueue.length === 0) return;
    const nextSong = roomQueue[0];
    const newQueue = roomQueue.slice(1);

    await pulseTable().update({
      current_song_data: nextSong as any,
      current_song_id: nextSong.id,
      is_playing: true,
      current_position: 0,
      position_updated_at: new Date().toISOString(),
      queue: newQueue as any,
    }).eq("id", activeSession.id);

    sendBroadcast({ type: 'skip', song: nextSong, actioner: displayName, actionerId: user?.id || '' });
    usePlayerStore.getState().playSong(nextSong);
    setActiveSong(nextSong);
    setRoomQueue(newQueue);
    setActiveSession(prev => prev ? { ...prev, current_song_data: nextSong, current_song_id: nextSong.id, is_playing: true, current_position: 0, queue: newQueue } : null);
  }, [activeSession, roomQueue, sendBroadcast, displayName, user?.id]);

  // Add to queue
  const addToQueueInPulse = useCallback(async (song: Song) => {
    if (!activeSession) return;
    const newQueue = [...roomQueue, song];

    await pulseTable().update({ queue: newQueue as any }).eq("id", activeSession.id);
    sendBroadcast({ type: 'queue_update', queue: newQueue, actioner: displayName, actionerId: user?.id || '' });
    setRoomQueue(newQueue);
    setActiveSession(prev => prev ? { ...prev, queue: newQueue } : null);
    toast.success(`"${song.title}" added to Pulse queue`);

    if (!activeSession.current_song_data) {
      playSongInPulse(song);
    }
  }, [activeSession, roomQueue, sendBroadcast, displayName, playSongInPulse, user?.id]);

  // Remove from queue
  const removeFromQueue = useCallback(async (index: number) => {
    if (!activeSession) return;
    const newQueue = roomQueue.filter((_, i) => i !== index);
    await pulseTable().update({ queue: newQueue as any }).eq("id", activeSession.id);
    sendBroadcast({ type: 'queue_update', queue: newQueue, actioner: displayName, actionerId: user?.id || '' });
    setRoomQueue(newQueue);
    setActiveSession(prev => prev ? { ...prev, queue: newQueue } : null);
  }, [activeSession, roomQueue, sendBroadcast, displayName, user?.id]);

  // Leave / End
  const leaveSession = async () => {
    if (!activeSession || !user) return;

    if (isCreator) {
      sendBroadcast({ type: 'session_end', actioner: displayName, actionerId: user.id });
      await pulseTable().delete().eq("id", activeSession.id);
    } else {
      await pulseTable().update({ member_count: Math.max(1, (activeSession.member_count || 1) - 1) }).eq("id", activeSession.id);
    }
    cleanupAndLeave();
  };

  const copyCode = () => {
    if (activeSession) {
      navigator.clipboard.writeText(activeSession.code);
      toast.success("Code copied!");
    }
  };

  // Position sync (creator only)
  useEffect(() => {
    if (!activeSession || !isCreator) return;

    positionSyncRef.current = setInterval(async () => {
      const player = usePlayerStore.getState();
      if (player.isPlaying) {
        await pulseTable().update({
          current_position: player.progress,
          position_updated_at: new Date().toISOString(),
        }).eq("id", activeSession.id);
      }
    }, 10000);

    return () => {
      if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    };
  }, [activeSession?.id, isCreator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (broadcastChannelRef.current) supabase.removeChannel(broadcastChannelRef.current);
      if (dbChannelRef.current) supabase.removeChannel(dbChannelRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    };
  }, []);

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ===== ACTIVE SESSION VIEW =====
  if (activeSession) {
    return (
      <div className="p-4 md:p-6 space-y-6 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-display font-bold text-foreground">{activeSession.name}</h2>
              {isCreator && <Crown className="h-4 w-4 text-primary" />}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {activeSession.is_playing && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
                <Users className="h-3.5 w-3.5" /> {activeSession.member_count} listening
              </span>
              <button onClick={copyCode} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <Copy className="h-3.5 w-3.5" /> {activeSession.code}
              </button>
            </div>
          </div>
          <button
            onClick={leaveSession}
            className="bg-destructive/10 text-destructive text-sm font-medium px-4 py-2 rounded-full hover:bg-destructive/20 transition-colors flex items-center gap-2"
          >
            <X className="h-4 w-4" /> {isCreator ? "End Pulse" : "Leave"}
          </button>
        </div>

        {/* Now Playing */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Now Playing</h3>
          {activeSong ? (
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                {activeSong.cover_image_url ? (
                  <CoverImg src={activeSong.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full gradient-primary opacity-40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-display font-semibold text-foreground truncate">{activeSong.title}</p>
                <p className="text-sm text-muted-foreground truncate">{activeSong.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayInPulse}
                  className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  {activeSession.is_playing ? (
                    <Pause className="h-5 w-5 text-primary-foreground" />
                  ) : (
                    <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                  )}
                </button>
                {roomQueue.length > 0 && (
                  <button
                    onClick={skipInPulse}
                    className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                  >
                    <SkipForward className="h-4 w-4 text-foreground" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Music className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No song playing yet</p>
              <button
                onClick={() => { setPickerMode("play"); setShowSongPicker(true); }}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Pick a song to start
              </button>
            </div>
          )}
        </div>

        {/* Queue */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ListMusic className="h-4 w-4" /> Queue ({roomQueue.length})
            </h3>
            <button
              onClick={() => { setPickerMode(activeSong ? "queue" : "play"); setShowSongPicker(true); }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Song
            </button>
          </div>
          {roomQueue.length > 0 ? (
            <div className="space-y-1">
              {roomQueue.map((song, i) => (
                <div key={`${song.id}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/60 transition-colors">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="h-9 w-9 rounded bg-secondary overflow-hidden flex-shrink-0">
                    {song.cover_image_url ? (
                      <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full gradient-primary opacity-30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <button onClick={() => removeFromQueue(i)} className="h-7 w-7 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Queue is empty</p>
          )}
        </div>

        {/* Song Picker Modal */}
        <AnimatePresence>
          {showSongPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4"
              onClick={() => setShowSongPicker(false)}
            >
              <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="bg-card border border-border rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-display font-bold text-foreground">
                    {pickerMode === "play" ? "Pick a Song" : "Add to Queue"}
                  </h3>
                  <button onClick={() => setShowSongPicker(false)}>
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search songs..."
                      className="w-full bg-secondary rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-0.5">
                  {filteredSongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/60 cursor-pointer transition-colors"
                      onClick={() => pickerMode === "play" ? playSongInPulse(song) : addToQueueInPulse(song)}
                    >
                      <div className="h-10 w-10 rounded bg-secondary overflow-hidden flex-shrink-0">
                        {song.cover_image_url ? (
                          <CoverImg src={song.cover_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full gradient-primary opacity-30" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      {pickerMode === "queue" ? (
                        <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <Play className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                  {filteredSongs.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No songs found</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== LOBBY VIEW =====
  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="text-center space-y-2 pt-8">
        <Zap className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-3xl font-display font-bold text-foreground">Pulse</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Listen together in real-time. Create a session or join one with a code.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 flex items-center justify-center gap-2 gradient-primary text-primary-foreground font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus className="h-5 w-5" /> Create Session
        </button>
        <button
          onClick={() => setShowJoin(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-secondary text-foreground font-semibold py-3 px-6 rounded-xl hover:bg-secondary/80 transition-colors border border-border"
        >
          <LogIn className="h-5 w-5" /> Join Session
        </button>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-display font-bold text-foreground">Create a Pulse</h3>
              <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Session name..." className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground font-medium">Cancel</button>
                <button onClick={handleCreate} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowJoin(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-display font-bold text-foreground">Join a Pulse</h3>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter 6-digit code..." maxLength={6} className="w-full bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-center tracking-[0.3em] font-mono text-lg" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => setShowJoin(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground font-medium">Cancel</button>
                <button onClick={handleJoin} className="flex-1 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium">Join</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}