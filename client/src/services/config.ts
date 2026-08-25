// Base URL of the backend (Express server that parses reports and renders posters).
//
// Web/dev builds leave this empty so requests stay relative and go through the
// Vite proxy. The Android build has no proxy — the WebView serves the UI from
// its own scheme — so it must point at the deployed server via VITE_API_BASE_URL.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

// Turns a server-relative path ('/api/...', '/posters/...') into a fetchable URL.
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
