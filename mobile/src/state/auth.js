import { create } from 'zustand';
import { api } from '../services/api';

// status: 'loading' (splash, so the login screen never flashes) | 'authed' | 'anon'
export const useAuth = create((set, get) => ({
  status: 'loading', user: null, offline: false,
  async restore() { const r = await api.restore(); set({ status: r.status, user: r.user ?? null, offline: !!r.offline }); },
  async revalidate() { // app came back to the foreground
    if (get().status !== 'authed') return;
    const r = await api.restore();
    if (r.status === 'anon') set({ status: 'anon', user: null }); else set({ user: r.user ?? get().user, offline: !!r.offline });
  },
  async login(email, password) { set({ user: await api.login(email.trim(), password), status: 'authed', offline: false }); },
  async register(name, email, password) { set({ user: await api.register(name.trim(), email.trim(), password), status: 'authed', offline: false }); },
  async logout() { await api.logout(); set({ status: 'anon', user: null }); },
  sessionLost() { set({ status: 'anon', user: null }); },
}));
api.onSessionLost(() => useAuth.getState().sessionLost());
