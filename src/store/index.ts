import { create } from 'zustand';

// ============================================
// AUTH / PROFILE STORE
// ============================================

interface Profile {
  user_id: string;
  nombre: string;
  rol: 'admin' | 'empleado' | 'gestor';
  apellido?: string;
  email?: string;
  avatar_url?: string;
}

interface AuthState {
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  isLoading: true,
  setProfile: (profile) => set({ profile, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ profile: null, isLoading: false }),
}));

// ============================================
// UI STORE  (sidebar, modals, toasts)
// ============================================

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));

// ============================================
// TIMERS STORE  (fichaje + task timer)
// ============================================

interface ActiveTask {
  id: number;
  start_at: string;
  nota?: string;
  comunidades?: { nombre_cdad: string; codigo?: string };
}

interface ActiveFichaje {
  id: number;
  start_at: string;
}

interface TimersState {
  activeTask: ActiveTask | null;
  activeFichaje: ActiveFichaje | null;
  setActiveTask: (task: ActiveTask | null) => void;
  setActiveFichaje: (fichaje: ActiveFichaje | null) => void;
}

export const useTimersStore = create<TimersState>((set) => ({
  activeTask: null,
  activeFichaje: null,
  setActiveTask: (activeTask) => set({ activeTask }),
  setActiveFichaje: (activeFichaje) => set({ activeFichaje }),
}));
