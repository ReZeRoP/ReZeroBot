import { create } from 'zustand';

interface AppState {
  isAuthenticated: boolean;
  user: any | null;
  language: 'fa' | 'en';
  setAuth: (token: string, user: any) => void;
  setLanguage: (lang: 'fa' | 'en') => void;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  isAuthenticated: false,
  user: null,
  language: 'fa',
  setAuth: (_token, user) => set({ isAuthenticated: true, user }),
  setLanguage: (lang) => set({ language: lang }),
  logout: () => set({ isAuthenticated: false, user: null }),
}));
