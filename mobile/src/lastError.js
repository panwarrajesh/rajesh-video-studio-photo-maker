import * as SecureStore from 'expo-secure-store';
const KEY = 'rvs_last_error';
// Remember the last crash so the "Connection check" screen can show it even after the app restarts.
export async function saveLastError(e) { try { await SecureStore.setItemAsync(KEY, `${new Date().toISOString()}\n${String(e?.stack || e?.message || e).slice(0, 1400)}`); } catch { /* never fail while reporting a failure */ } }
export const readLastError = () => SecureStore.getItemAsync(KEY).catch(() => null);
export const clearLastError = () => SecureStore.deleteItemAsync(KEY).catch(() => {});
