import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { updateListeningStreak } from '@/hooks/useListeningStreak';
import { getAudioUrl } from '@/lib/telegram';


export type Song = Tables<'songs'>;

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  showFullPlayer: boolean;
  showQueue: boolean;
  audio: HTMLAudioElement | null;

  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  setVolume: (vol: number) => void;
  seekTo: (time: number) => void;
  setProgress: (p: number) => void;
  setDuration: (d: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleFullPlayer: () => void;
  toggleQueue: () => void;
  closePlayer: () => void;
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  handleSongEnd: () => void;
}

let currentPlayRecordId: string | null = null;
let accumulatedSeconds = 0;
let segmentStartTime: number | null = null;

const pauseListeningTimer = () => {
  if (segmentStartTime) {
    accumulatedSeconds += Math.round((Date.now() - segmentStartTime) / 1000);
    segmentStartTime = null;
  }
};

const resumeListeningTimer = () => {
  segmentStartTime = Date.now();
};

const saveListenedDuration = async () => {
  pauseListeningTimer();
  if (currentPlayRecordId && accumulatedSeconds > 0) {
    await supabase
      .from('recently_played')
      .update({ listened_duration: accumulatedSeconds } as any)
      .eq('id', currentPlayRecordId);
    updateListeningMinutes(accumulatedSeconds).catch(() => {});
  }
  currentPlayRecordId = null;
  accumulatedSeconds = 0;
};

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const updateListeningActivity = async (songId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = toLocalDateStr(new Date());

    const { data: existing } = await supabase
      .from("user_listening_activity")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_listening_activity")
        .update({ songs_played: (existing as any).songs_played + 1 } as any)
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("user_listening_activity").insert({
        user_id: user.id, date: today, minutes_listened: 0, songs_played: 1,
      } as any);
    }
  } catch (e) { /* silent */ }
};

const updateListeningMinutes = async (seconds: number) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || seconds <= 0) return;
    const today = toLocalDateStr(new Date());
    const minutes = seconds / 60;

    const { data: existing } = await supabase
      .from("user_listening_activity")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_listening_activity")
        .update({ minutes_listened: (existing as any).minutes_listened + minutes } as any)
        .eq("id", (existing as any).id);
    }
  } catch (e) { /* silent */ }
};

const trackPlay = async (songId: string) => {
  try {
    await saveListenedDuration();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('increment_play_count', { song_id: songId });
    updateListeningStreak().catch(() => {});
    updateListeningActivity(songId).catch(() => {});

    const { data } = await supabase.from('recently_played').insert({
      user_id: user.id, song_id: songId,
    }).select('id').single();

    if (data) {
      currentPlayRecordId = data.id;
      accumulatedSeconds = 0;
      resumeListeningTimer();
    }
  } catch (e) {
    console.error('Failed to track play:', e);
  }
};

function resolveAudioSrc(song: Song): string | null {
  return getAudioUrl(song as any);
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  isPlaying: false,
  volume: 0.7,
  progress: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off',
  showFullPlayer: false,
  showQueue: false,
  audio: null,

  playSong: (song, queue) => {
    const state = get();
    if (state.audio) {
      state.audio.pause();
      state.audio.src = '';
    }

    // Set song immediately (shows UI), then resolve audio async
    const newQueue = queue || state.queue;
    set({
      currentSong: song,
      isPlaying: false,
      progress: 0,
      duration: 0,
      ...(queue ? { queue } : {}),
    });

    const audioSrc = resolveAudioSrc(song);
    if (!audioSrc) return;

    const audio = new Audio(audioSrc);
    audio.volume = get().volume;

    audio.addEventListener('timeupdate', () => {
      set({ progress: audio.currentTime });
    });
    audio.addEventListener('loadedmetadata', () => {
      set({ duration: audio.duration });
    });
    audio.addEventListener('ended', () => {
      get().handleSongEnd();
    });

    audio.play();
    set({ audio, isPlaying: true });

    try {
      localStorage.setItem('muzixhub_last_song', JSON.stringify(song));
      if (queue) localStorage.setItem('muzixhub_last_queue', JSON.stringify(queue));
    } catch {}

    trackPlay(song.id);
  },

  togglePlay: () => {
    const { audio, isPlaying } = get();
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      pauseListeningTimer();
    } else {
      audio.play();
      resumeListeningTimer();
    }
    set({ isPlaying: !isPlaying });
  },

  nextSong: async () => {
    const { queue, currentSong, shuffle } = get();
    
    if (queue.length > 0) {
      const currentIndex = queue.findIndex((s) => s.id === currentSong?.id);
      if (currentIndex < queue.length - 1 || shuffle) {
        let nextIndex: number;
        if (shuffle) {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else {
          nextIndex = (currentIndex + 1) % queue.length;
        }
        get().playSong(queue[nextIndex]);
        return;
      }
    }

    await fetchSmartSong(get, currentSong);
  },

  prevSong: () => {
    const { queue, currentSong, audio } = get();
    if (!audio) return;

    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (queue.length === 0) return;
    const currentIndex = queue.findIndex((s) => s.id === currentSong?.id);
    const prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    get().playSong(queue[prevIndex]);
  },

  setVolume: (vol) => {
    const { audio } = get();
    if (audio) audio.volume = vol;
    set({ volume: vol });
  },

  seekTo: (time) => {
    const { audio } = get();
    if (audio) audio.currentTime = time;
    set({ progress: time });
  },

  setProgress: (p) => set({ progress: p }),
  setDuration: (d) => set({ duration: d }),

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  toggleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    })),

  toggleFullPlayer: () => set((s) => ({ showFullPlayer: !s.showFullPlayer })),
  toggleQueue: () => set((s) => ({ showQueue: !s.showQueue })),

  closePlayer: () => {
    saveListenedDuration();
    const { audio } = get();
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    set({
      currentSong: null,
      queue: [],
      isPlaying: false,
      progress: 0,
      duration: 0,
      showFullPlayer: false,
      showQueue: false,
      audio: null,
    });
  },

  addToQueue: (song) => {
    const { currentSong, queue } = get();
    if (!currentSong) {
      get().playSong(song, [song]);
    } else {
      set({ queue: [...queue, song] });
    }
  },

  playNext: (song) => {
    const { currentSong, queue } = get();
    if (!currentSong) {
      get().playSong(song, [song]);
    } else {
      const currentIndex = queue.findIndex((s) => s.id === currentSong.id);
      const newQueue = [...queue];
      newQueue.splice(currentIndex + 1, 0, song);
      set({ queue: newQueue });
    }
  },

  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),

  reorderQueue: (from, to) =>
    set((s) => {
      const q = [...s.queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      return { queue: q };
    }),

  handleSongEnd: async () => {
    saveListenedDuration();
    const { repeat, currentSong, queue } = get();
    
    if (repeat === 'one' && currentSong) {
      get().playSong(currentSong);
      return;
    }
    
    if (queue.length > 0) {
      const currentIndex = queue.findIndex((s) => s.id === currentSong?.id);
      if (currentIndex < queue.length - 1) {
        get().nextSong();
        return;
      }
      if (repeat === 'all') {
        get().playSong(queue[0], queue);
        return;
      }
    }

    await fetchSmartSong(get, currentSong);
  },
}));

async function fetchSmartSong(get: () => PlayerState, currentSong: Song | null) {
  if (!currentSong) return;

  if (currentSong.genre) {
    const { data } = await supabase
      .from('songs')
      .select('*')
      .eq('genre', currentSong.genre)
      .neq('id', currentSong.id)
      .order('plays', { ascending: false })
      .limit(15);

    if (data && data.length > 0) {
      const pick = data[Math.floor(Math.random() * data.length)];
      get().playSong(pick);
      return;
    }
  }

  const { data: artistSongs } = await supabase
    .from('songs')
    .select('*')
    .eq('artist', currentSong.artist)
    .neq('id', currentSong.id)
    .limit(10);

  if (artistSongs && artistSongs.length > 0) {
    const pick = artistSongs[Math.floor(Math.random() * artistSongs.length)];
    get().playSong(pick);
    return;
  }

  const { data: any } = await supabase
    .from('songs')
    .select('*')
    .neq('id', currentSong.id)
    .order('plays', { ascending: false })
    .limit(20);

  if (any && any.length > 0) {
    const pick = any[Math.floor(Math.random() * any.length)];
    get().playSong(pick);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    saveListenedDuration();
    const state = usePlayerStore.getState();
    if (state.currentSong) {
      try {
        localStorage.setItem('muzixhub_last_progress', String(state.progress));
      } catch {}
    }
  });

  setTimeout(() => {
    try {
      const songRaw = localStorage.getItem('muzixhub_last_song');
      if (!songRaw) return;
      const song = JSON.parse(songRaw) as Song;
      const queueRaw = localStorage.getItem('muzixhub_last_queue');
      const queue = queueRaw ? JSON.parse(queueRaw) as Song[] : [song];
      const progressRaw = localStorage.getItem('muzixhub_last_progress');
      const savedProgress = progressRaw ? parseFloat(progressRaw) : 0;

      const state = usePlayerStore.getState();
      if (state.currentSong) return;

      resolveAudioSrc(song).then((audioSrc) => {
        if (!audioSrc) return;
        const currentState = usePlayerStore.getState();
        if (currentState.currentSong) return;

        const audio = new Audio(audioSrc);
        audio.volume = currentState.volume;
        audio.addEventListener('timeupdate', () => {
          usePlayerStore.setState({ progress: audio.currentTime });
        });
        audio.addEventListener('loadedmetadata', () => {
          usePlayerStore.setState({ duration: audio.duration });
          if (savedProgress > 0 && savedProgress < audio.duration) {
            audio.currentTime = savedProgress;
          }
        });
        audio.addEventListener('ended', () => {
          usePlayerStore.getState().handleSongEnd();
        });

        usePlayerStore.setState({
          currentSong: song,
          queue,
          audio,
          isPlaying: false,
          progress: savedProgress,
        });
      }).catch(() => {});
    } catch {}
  }, 100);
}
