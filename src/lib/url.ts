const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Prefix an internal path with the deployment base path
 * (e.g. "/cyberpulse-intelligence" on GitHub Pages).
 * Internal paths get a trailing slash because GitHub Pages serves
 * directory indexes only for URLs that end in "/".
 */
export function withBase(path = '/'): string {
  if (/^(https?:|mailto:|#)/.test(path)) return path;
  let clean = path.startsWith('/') ? path : `/${path}`;
  const lastSegment = clean.split('/').pop() ?? '';
  if (!clean.endsWith('/') && !lastSegment.includes('.') && !clean.includes('#')) {
    clean += '/';
  }
  return `${BASE}${clean}`;
}
