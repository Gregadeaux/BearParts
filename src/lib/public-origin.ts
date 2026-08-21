/**
 * Public origin for redirect URLs. Behind Fly's proxy, request.url's origin is
 * the internal bind address — reconstruct from forwarded headers.
 */
export function publicOrigin(request: Request): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;
}
