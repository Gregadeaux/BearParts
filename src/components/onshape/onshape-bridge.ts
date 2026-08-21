"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OnshapeDocContext } from "@/services/onshape/types";

/**
 * postMessage bridge to the embedding Onshape client.
 *
 * After we send `applicationInit`, Onshape pushes `SELECTION` messages on
 * every graphics-area selection. Their payload is officially undocumented, so
 * parsing is deliberately tolerant and raw payloads are logged for discovery.
 * `requestSelection` (documented) is the guaranteed fallback path.
 */

export interface PanelUrlContext extends OnshapeDocContext {
  /** Onshape server origin (from the auto-appended `server` param) */
  server: string | null;
}

/** Extension action URL params → document context. */
export function parsePanelContext(params: URLSearchParams): PanelUrlContext | null {
  const documentId = params.get("documentId");
  const wvm = params.get("wvm");
  const wvmId = params.get("wvmid");
  const elementId = params.get("elementId");
  if (!documentId || !wvmId || !elementId || (wvm !== "w" && wvm !== "v")) return null;
  let server: string | null = null;
  try {
    const raw = params.get("server");
    server = raw ? new URL(raw).origin : null;
  } catch {
    server = null;
  }
  return { documentId, wvm, wvmId, elementId, server };
}

export interface OnshapeSelection {
  faceId: string | null;
  partId: string | null;
  /** workspaceMicroversionId from the event — geometry ids are scoped to it */
  microversion: string | null;
}

/** Best-effort extraction of face/part ids from an undocumented payload. */
export function parseSelectionMessage(data: unknown): OnshapeSelection | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const candidates: Record<string, unknown>[] = [];
  for (const key of ["selections", "selection", "entities"]) {
    const v = d[key];
    if (Array.isArray(v)) candidates.push(...(v as Record<string, unknown>[]));
    else if (v && typeof v === "object") candidates.push(v as Record<string, unknown>);
  }
  candidates.push(d);

  let faceId: string | null = null;
  let partId: string | null = null;
  let microversion: string | null = null;
  for (const c of candidates) {
    const type = String(c.entityType ?? c.type ?? "").toUpperCase();
    const id = [c.selectionId, c.id, c.transientId, c.deterministicId].find(
      (v) => typeof v === "string" && v.length > 0,
    ) as string | undefined;
    if (typeof c.partId === "string" && c.partId && !partId) partId = c.partId;
    if (typeof c.workspaceMicroversionId === "string" && !microversion) {
      microversion = c.workspaceMicroversionId;
    }
    if (!id) continue;
    if (type.includes("FACE") && !faceId) faceId = id;
    if (type.includes("BODY") && !partId) partId = id;
  }
  if (!faceId && !partId) return null;
  return { faceId, partId, microversion };
}

interface BridgeHandlers {
  onSelection?: (sel: OnshapeSelection) => void;
}

export function useOnshapeBridge(ctx: PanelUrlContext | null, handlers: BridgeHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const embedded = typeof window !== "undefined" && window.parent !== window;

  const baseMessage = useCallback(
    () =>
      ctx && {
        documentId: ctx.documentId,
        workspaceId: ctx.wvm === "w" ? ctx.wvmId : "",
        elementId: ctx.elementId,
      },
    [ctx],
  );

  useEffect(() => {
    if (!ctx || !embedded) return;
    const base = baseMessage();
    if (!base) return;
    window.parent.postMessage({ ...base, messageName: "applicationInit" }, "*");

    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin) return; // our own popups
      // the SELECTION payload is undocumented — log everything Onshape sends
      // so real payload shapes can be captured from the console
      console.log("[BearParts panel] message from", e.origin, JSON.stringify(e.data));
      // only trust the embedding Onshape server (when known)
      if (ctx.server && e.origin !== ctx.server) return;
      const data = e.data as { messageName?: string } | undefined;
      if (!data?.messageName) return;
      const name = String(data.messageName).toUpperCase();
      if (name.includes("SELECT")) {
        const sel = parseSelectionMessage(e.data);
        if (sel) handlersRef.current.onSelection?.(sel);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ctx, embedded, baseMessage]);

  /** Documented path: ask Onshape to put the user in face-selection mode. */
  const requestFaceSelection = useCallback(() => {
    const base = baseMessage();
    if (!base || !embedded) return;
    window.parent.postMessage(
      {
        ...base,
        messageName: "requestSelection",
        messageId: crypto.randomUUID(),
        entityTypeSpecifier: ["FACE"],
        requiredSelectionCount: 1,
      },
      "*",
    );
  }, [baseMessage, embedded]);

  /** Highlight a face in the graphics area (best effort). */
  const highlightFace = useCallback(
    (faceId: string) => {
      const base = baseMessage();
      if (!base || !embedded) return;
      window.parent.postMessage(
        {
          ...base,
          messageName: "requestSelectionHighlight",
          selections: [{ selectionType: "ENTITY", selectionId: faceId, entityType: "FACE" }],
        },
        "*",
      );
    },
    [baseMessage, embedded],
  );

  return { embedded, requestFaceSelection, highlightFace };
}
