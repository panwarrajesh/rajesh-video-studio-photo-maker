import { create } from 'zustand';
import { api, setTokens, clearTokens } from '../services/api.js';

export const useAuth = create((set) => ({
  user: { name: 'Rajesh', plan: 'PRO' },
  loading: false,
  async init() {
    try {
      const data = await api('/auth/me');
      if (data?.user) set({ user: data.user, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  async submit(mode, form) {
    const d = await api(`/auth/${mode}`, { method: 'POST', body: form });
    setTokens(d);
    set({ user: d.user });
  },
  logout() {
    clearTokens();
  },
}));
