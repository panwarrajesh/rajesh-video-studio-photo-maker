// Set EXPO_PUBLIC_API_URL (see .env.example / eas.json). Nothing is hardcoded to localhost.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
export const mediaUrl = (u) => (/^https?:/.test(u) ? u : `${API_URL.replace(/\/api$/, '')}${u}`);
export const APP_VERSION = '1.2.0';
