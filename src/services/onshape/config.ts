/**
 * Onshape integration configuration. All server-side — never expose the
 * client secret to the browser.
 *
 * Env:
 *  - ONSHAPE_CLIENT_ID / ONSHAPE_CLIENT_SECRET  OAuth app from the Onshape dev portal
 *  - ONSHAPE_OAUTH_BASE  default https://oauth.onshape.com
 *  - ONSHAPE_API_BASE    default https://cad.onshape.com/api/v12
 *  - ONSHAPE_MOCK=1      serve canned data so the panel works without credentials
 */

export const OAUTH_BASE = process.env.ONSHAPE_OAUTH_BASE ?? "https://oauth.onshape.com";
export const API_BASE = process.env.ONSHAPE_API_BASE ?? "https://cad.onshape.com/api/v12";

/** Scopes: read documents + run exports. */
export const OAUTH_SCOPES = "OAuth2Read";

export const isOnshapeMock = () => process.env.ONSHAPE_MOCK === "1";

export const isOnshapeConfigured = () =>
  isOnshapeMock() ||
  Boolean(process.env.ONSHAPE_CLIENT_ID && process.env.ONSHAPE_CLIENT_SECRET);

export function onshapeCredentials() {
  const clientId = process.env.ONSHAPE_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Onshape is not configured");
  return { clientId, clientSecret };
}
