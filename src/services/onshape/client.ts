import { API_BASE } from "./config";

/**
 * Low-level Onshape REST transport with an in-memory TTL cache.
 *
 * Onshape rate limits are tight, so every GET goes through the cache and
 * callers pick a TTL suited to how volatile the data is. Geometry-derived
 * responses should key on the microversion — same microversion, same geometry,
 * cache indefinitely (capped by MAX_TTL).
 */

const MAX_ENTRIES = 500;
export const MAX_TTL = 30 * 60 * 1000;

interface CacheEntry {
  value: unknown;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // refresh recency (Map iterates in insertion order — delete/set moves to end)
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function cacheSet(key: string, value: unknown, ttl: number) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expires: Date.now() + Math.min(ttl, MAX_TTL) });
}

export class OnshapeApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Raw request. Throws OnshapeApiError on non-2xx (429 = rate limited). */
export async function onshapeFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json;charset=UTF-8; qs=0.09",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OnshapeApiError(
      res.status === 429
        ? "Onshape rate limit hit — try again in a moment"
        : `Onshape API error ${res.status}: ${detail.slice(0, 300)}`,
      res.status,
    );
  }
  return res;
}

export async function onshapeJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await onshapeFetch(accessToken, path, init);
  return (await res.json()) as T;
}

/**
 * Cached GET. `cacheKey` should include everything that makes the response
 * unique (path usually suffices; add the microversion for geometry queries).
 * Concurrent calls for the same key share one in-flight request.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function onshapeCachedJson<T>(
  accessToken: string,
  path: string,
  options: { ttl: number; cacheKey?: string },
): Promise<T> {
  const key = options.cacheKey ?? path;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = onshapeJson<T>(accessToken, path)
    .then((value) => {
      cacheSet(key, value, options.ttl);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** POSTs are never cached automatically; use this for cacheable evaluations. */
export async function onshapeCachedPost<T>(
  accessToken: string,
  path: string,
  body: unknown,
  options: { ttl: number; cacheKey: string },
): Promise<T> {
  const hit = cacheGet(options.cacheKey);
  if (hit !== undefined) return hit as T;
  const pending = inflight.get(options.cacheKey);
  if (pending) return pending as Promise<T>;

  const promise = onshapeJson<T>(accessToken, path, {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((value) => {
      cacheSet(options.cacheKey, value, options.ttl);
      return value;
    })
    .finally(() => inflight.delete(options.cacheKey));
  inflight.set(options.cacheKey, promise);
  return promise;
}

/** Test hook. */
export function clearOnshapeCache() {
  cache.clear();
  inflight.clear();
}
