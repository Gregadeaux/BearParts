"use client";

import { getPanelClient } from "@/lib/supabase/panel-client";

/** Bearer-auth fetch helpers for the panel's API routes. */

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await getPanelClient().auth.getSession();
  if (!session) throw new Error("Not signed in");
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function panelFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = await authHeader();
  const res = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON error body
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res;
}

export async function panelJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await panelFetch(path, init);
  return (await res.json()) as T;
}

export async function panelBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await panelFetch(path, init);
  return res.blob();
}
