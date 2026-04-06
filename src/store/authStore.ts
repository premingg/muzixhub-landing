import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  email: string;
  profile_image: string | null;
  created_at: string;
}

interface AuthState {
  user: SupabaseUser | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  setUser: (user: SupabaseUser | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  fetchProfile: (userId: string) => Promise<void>;
  checkAdmin: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) set({ profile: data as Profile });
  },

  checkAdmin: async (userId: string) => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    set({ isAdmin: !!data });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAuthenticated: false, isAdmin: false });
  },
}));
