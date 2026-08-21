import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { OAUTH_BASE, OAUTH_SCOPES, isOnshapeMock, onshapeCredentials } from "./config";

type Client = SupabaseClient<Database>;

export interface OnshapeTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the access token expires */
  expiresAt: number;
}

/** Authorization URL the user's browser is sent to (top-level popup). */
export function authorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = onshapeCredentials();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPES,
    state,
  });
  return `${OAUTH_BASE}/oauth/authorize?${params}`;
}

async function tokenRequest(body: URLSearchParams): Promise<OnshapeTokens> {
  const { clientId, clientSecret } = onshapeCredentials();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Onshape token request failed (${res.status})`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export function exchangeCode(code: string, redirectUri: string): Promise<OnshapeTokens> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

export function refreshTokens(refreshToken: string): Promise<OnshapeTokens> {
  return tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

/** Persist tokens for a user (upsert — reconnecting overwrites). */
export async function saveTokens(supabase: Client, userId: string, tokens: OnshapeTokens) {
  const { error } = await supabase.from("onshape_accounts").upsert({
    user_id: userId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: new Date(tokens.expiresAt).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save Onshape connection: ${error.message}`);
}

export async function disconnect(supabase: Client, userId: string) {
  const { error } = await supabase.from("onshape_accounts").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not disconnect Onshape: ${error.message}`);
}

export async function hasConnection(supabase: Client, userId: string): Promise<boolean> {
  if (isOnshapeMock()) return true;
  const { data } = await supabase
    .from("onshape_accounts")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * A valid access token for the user, refreshing (and persisting) when the
 * stored one expires within 2 minutes. Returns null when not connected.
 */
export async function getValidAccessToken(supabase: Client, userId: string): Promise<string | null> {
  if (isOnshapeMock()) return "mock-token";
  const { data, error } = await supabase
    .from("onshape_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Onshape connection: ${error.message}`);
  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - Date.now() > 2 * 60 * 1000) return data.access_token;

  const fresh = await refreshTokens(data.refresh_token);
  await saveTokens(supabase, userId, fresh);
  return fresh.accessToken;
}
