/**
 * Durable link printed as the drawing's QR code. Same origin rule as the
 * app's OG metadata (layout.tsx metadataBase): NEXT_PUBLIC_SITE_URL, else the
 * production host — so a sheet generated on a dev server or the tailnet IP
 * still points at the real app. The library part page outlives queue
 * entries, so it wins when the part came from the library.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bearparts.fly.dev").replace(/\/+$/, "");

export function partPageUrl(ids: { libraryPartId?: string | null; partId?: string | null }): string | null {
  if (ids.libraryPartId) return `${SITE_URL}/library/parts/${ids.libraryPartId}`;
  if (ids.partId) return `${SITE_URL}/parts/${ids.partId}`;
  return null;
}
