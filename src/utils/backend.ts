/**
 * Every call below resolves to a backend origin: same-origin is correct when the host runs the
 * agent (local `npm run dev`, the Docker container, or the Vercel Function that serves `/api/*`
 * and `/live`), and the override is for a UI deployed apart from its server.
 * Order: localStorage override, then VITE_BACKEND_URL, then same-origin.
 */
const STORAGE_KEY = 'growpilot.backendOrigin';

export function normalizeBackendOrigin(input: string): string | null {
  const raw = input.trim();
  if (!raw) return '';
  const withScheme = /^wss?:\/\//i.test(raw)
    ? raw.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:')
    : raw;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function saveBackendOrigin(input: string): { ok: boolean; origin: string } {
  const origin = normalizeBackendOrigin(input);
  if (origin === null) return { ok: false, origin: '' };
  try {
    if (origin) localStorage.setItem(STORAGE_KEY, origin);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private-mode storage failures fall back to the build-time default.
  }
  return { ok: true, origin };
}

export function backendOrigin(): string {
  let stored = '';
  try {
    stored = localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    stored = '';
  }
  return stored || (import.meta.env.VITE_BACKEND_URL?.trim() || '');
}

export function apiUrl(path: string): string {
  const origin = backendOrigin();
  return origin ? `${origin}${path}` : path;
}

export function wsUrl(pathWithQuery: string): string {
  const origin = backendOrigin();
  if (!origin) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${pathWithQuery}`;
  }
  const url = new URL(origin);
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${url.host}${pathWithQuery}`;
}
