/** The published site the app reads from. */
export const SITE = 'https://dailynoodle.co.uk';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

/** GET a JSON file from the site, bypassing HTTP caches, with a time limit. */
export async function getJson<T = unknown>(path: string, timeoutMs = 15_000): Promise<T> {
  const url = `${SITE}/${path.replace(/^\//, '')}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new HttpError(res.status, url);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
