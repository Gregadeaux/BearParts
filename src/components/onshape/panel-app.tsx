"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Box,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MousePointerClick,
  RefreshCw,
  Send,
} from "lucide-react";
import type {
  FacesResponse,
  PlanarFace,
  StatusResponse,
  StudioContextResponse,
  StudioPart,
} from "@/services/onshape/types";
import { generateThumbnail } from "@/lib/thumbnails";
import { PART_METHODS, type PartMethod } from "@/types/part";
import { usePanelSession } from "./use-panel-session";
import { panelBlob, panelJson } from "./panel-api";
import { parsePanelContext, useOnshapeBridge, type PanelUrlContext } from "./onshape-bridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MOCK_CTX: PanelUrlContext = {
  documentId: "mock-doc",
  wvm: "w",
  wvmId: "mock-ws",
  elementId: "mock-el",
  server: null,
};

interface PanelSubsystem {
  id: string;
  name: string;
  folderId: string;
  projectName: string | null;
}

type ExportMode = "dxf" | "step";
type Busy = null | "exporting" | "importing";

interface ImportResult {
  libraryPartId: string;
  queuedPartId: string | null;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Pick the subsystem whose name appears in the document or tab name. */
function matchSubsystem(subsystems: PanelSubsystem[], ...names: string[]): string | null {
  const haystack = names.map(normalize).join(" | ");
  let best: { id: string; len: number } | null = null;
  for (const s of subsystems) {
    const needle = normalize(s.name);
    if (!needle) continue;
    if (haystack.includes(needle) && (!best || needle.length > best.len)) {
      best = { id: s.id, len: needle.length };
    }
  }
  return best?.id ?? null;
}

const ctxQuery = (ctx: PanelUrlContext) =>
  `did=${ctx.documentId}&wvm=${ctx.wvm}&wvmid=${ctx.wvmId}&eid=${ctx.elementId}`;

const fmtIn = (v: number) => `${Number(v.toFixed(3))}`;

/** The Onshape right-panel app. Runs iframe'd inside cad.onshape.com. */
export function PanelApp() {
  const searchParams = useSearchParams();
  const { session, loading: sessionLoading, signIn, signOut } = usePanelSession();

  const urlCtx = useMemo(() => parsePanelContext(new URLSearchParams(searchParams)), [searchParams]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const ctx = urlCtx ?? (status?.mock ? MOCK_CTX : null);

  const [studio, setStudio] = useState<StudioContextResponse | null>(null);
  const [subsystems, setSubsystems] = useState<PanelSubsystem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<ExportMode>("dxf");
  // picks are user/Onshape choices; effective values derive from them below
  const [pickedPartId, setPickedPartId] = useState<string | null>(null);
  const [facesFor, setFacesFor] = useState<{ key: string; faces: PlanarFace[] } | null>(null);
  const [pickedFaceId, setPickedFaceId] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<{ key: string; url: string } | null>(null);

  // form fields autofill from the selected part; edits are keyed per part so
  // switching parts re-autofills without effects
  const [nameEdit, setNameEdit] = useState<{ key: string | null; value: string } | null>(null);
  const [materialEdit, setMaterialEdit] = useState<{ key: string | null; value: string } | null>(null);
  const [subsystemPick, setSubsystemPick] = useState<string | null>(null);
  const [thickness, setThickness] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [queue, setQueue] = useState(false);
  // fabrication flow defaults per export mode (dxf→laser, step→cnc), keyed so
  // switching modes re-defaults without effects
  const [methodPick, setMethodPick] = useState<{ mode: ExportMode; value: PartMethod } | null>(null);
  const fabMethod: PartMethod =
    methodPick?.mode === mode ? methodPick.value : mode === "dxf" ? "laser" : "cnc";

  const [busy, setBusy] = useState<Busy>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ---- Onshape selection bridge -------------------------------------------
  const studioRef = useRef<StudioContextResponse | null>(null);
  useEffect(() => {
    studioRef.current = studio;
  }, [studio]);
  const { embedded, requestFaceSelection } = useOnshapeBridge(ctx, {
    onSelection: (sel) => {
      if (sel.partId && studioRef.current?.parts.some((p) => p.partId === sel.partId)) {
        setPickedPartId(sel.partId);
      }
      if (!sel.faceId) return;
      setPickedFaceId(sel.faceId);
      // SELECTION only carries the face — resolve its owning part server-side
      if (!sel.partId && ctx) {
        const mv = sel.microversion ? `&mv=${encodeURIComponent(sel.microversion)}` : "";
        panelJson<{ partId: string | null }>(
          `/api/onshape/resolve-face?${ctxQuery(ctx)}&faceId=${encodeURIComponent(sel.faceId)}${mv}`,
        )
          .then((r) => {
            if (!r.partId) return;
            const known = studioRef.current?.parts.some((p) => p.partId === r.partId);
            if (!known && studioRef.current) {
              console.warn(
                "[BearParts panel] resolved part not in parts list",
                r.partId,
                studioRef.current.parts.map((p) => p.partId),
              );
            }
            if (known || !studioRef.current) setPickedPartId(r.partId);
          })
          .catch(() => {});
      }
    },
  });

  // ---- data loading -------------------------------------------------------
  useEffect(() => {
    if (!session) return;
    let stale = false;
    panelJson<StatusResponse>("/api/onshape/status")
      .then((s) => !stale && setStatus(s))
      .catch((e) => !stale && setLoadError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      stale = true;
    };
  }, [session]);

  const connected = Boolean(status?.connected);

  const loadStudio = useCallback(() => {
    if (!session || !ctx || !connected) return;
    panelJson<StudioContextResponse>(`/api/onshape/context?${ctxQuery(ctx)}`)
      .then((s) => {
        setStudio(s);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not reach Onshape"));
    panelJson<{ subsystems: PanelSubsystem[] }>("/api/onshape/subsystems")
      .then((r) => setSubsystems(r.subsystems))
      .catch(() => {});
    // session/ctx/connected are stable identities per load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ctx?.documentId, ctx?.wvmId, ctx?.elementId, connected]);

  useEffect(loadStudio, [loadStudio]);

  // effective part: explicit pick, else the studio's only part
  const partId =
    pickedPartId ?? (studio?.parts.length === 1 ? studio.parts[0].partId : null);
  const part: StudioPart | null = studio?.parts.find((p) => p.partId === partId) ?? null;

  // form values derive from the part until edited (edits are keyed per part)
  const name = nameEdit?.key === partId ? nameEdit.value : (part?.name ?? "");
  const material =
    materialEdit?.key === partId ? materialEdit.value : (part?.material ?? "");
  const subsystemId =
    subsystemPick ??
    (studio && subsystems.length > 0
      ? matchSubsystem(subsystems, studio.documentName, studio.elementName)
      : null);

  // faces for DXF mode
  useEffect(() => {
    if (!session || !ctx || !connected || !partId || mode !== "dxf") return;
    let stale = false;
    panelJson<FacesResponse>(`/api/onshape/faces?${ctxQuery(ctx)}&partId=${encodeURIComponent(partId)}`)
      .then((r) => !stale && setFacesFor({ key: partId, faces: r.faces }))
      .catch((e) => !stale && toast.error(e instanceof Error ? e.message : "Could not list faces"));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, connected, partId, mode, ctx?.documentId, ctx?.wvmId, ctx?.elementId]);

  // shaded-view preview
  useEffect(() => {
    if (!session || !ctx || !connected || !partId) return;
    let stale = false;
    let url: string | null = null;
    panelBlob(`/api/onshape/preview?${ctxQuery(ctx)}&partId=${encodeURIComponent(partId)}`)
      .then((blob) => {
        if (stale) return;
        url = URL.createObjectURL(blob);
        setPreviewFor({ key: partId, url });
      })
      .catch(() => {});
    return () => {
      stale = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, connected, partId, ctx?.documentId, ctx?.wvmId, ctx?.elementId]);

  const faces = facesFor?.key === partId ? facesFor.faces : null;
  const preview = previewFor?.key === partId ? previewFor.url : null;
  // Onshape SELECTION face ids win even when they're not in our list
  const faceId = pickedFaceId ?? faces?.[0]?.faceId ?? null;
  const face: PlanarFace | null = faces?.find((f) => f.faceId === faceId) ?? null;
  const subsystem = subsystems.find((s) => s.id === subsystemId) ?? null;

  // ---- submit -------------------------------------------------------------
  const canSubmit =
    Boolean(session && ctx && connected && partId && name.trim() && busy === null) &&
    (mode === "step" || Boolean(faceId));

  const submit = async () => {
    if (!ctx || !partId) return;
    try {
      setBusy("exporting");
      const safeName = name.trim().replace(/[\\/:*?"<>|]+/g, "") || "part";
      let file: File;
      if (mode === "dxf") {
        const res = await panelJson<{ dxf: string; envelope: { width: number; height: number } }>(
          "/api/onshape/export",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, context: ctx, partId, faceId }),
          },
        );
        file = new File([res.dxf], `${safeName}.dxf`, { type: "application/dxf" });
      } else {
        const blob = await panelBlob("/api/onshape/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, context: ctx, partId }),
        });
        file = new File([blob], `${safeName}.step`, { type: "application/step" });
      }

      setBusy("importing");
      const thumb = await generateThumbnail(file, mode).catch(() => null);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", name.trim());
      if (subsystem) fd.set("folderId", subsystem.folderId);
      if (thumb) fd.set("thumb", new File([thumb], "thumb.png", { type: "image/png" }));
      const noteBits = [`From Onshape: ${studio?.documentName ?? "document"} / ${studio?.elementName ?? "tab"}`];
      if (thickness.trim()) noteBits.push(`${thickness.trim()} in thick`);
      fd.set("note", noteBits.join(" — "));
      if (queue) {
        fd.set("queue", "1");
        fd.set("quantity", String(quantity));
        fd.set("method", fabMethod);
        fd.set(
          "material",
          [material.trim(), thickness.trim() && `${thickness.trim()} in`].filter(Boolean).join(" · "),
        );
      }
      const imported = await panelJson<ImportResult>("/api/onshape/import", {
        method: "POST",
        body: fd,
      });
      setResult(imported);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  // ---- render -------------------------------------------------------------
  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-svh flex-col bg-background text-sm">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex size-6 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
          BP
        </span>
        <span className="font-semibold">BearParts</span>
        {status?.mock && <Badge variant="secondary">mock</Badge>}
        <span className="flex-1" />
        {session && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut className="size-3.5" />
          </Button>
        )}
      </header>
      <div className="flex-1 space-y-3 p-3">{children}</div>
    </div>
  );

  if (sessionLoading) return shell(<Skeleton className="h-24 w-full" />);

  if (!session) {
    return shell(
      <div className="space-y-3 pt-8 text-center">
        <p className="text-muted-foreground">
          Sign in to send parts from Onshape into BearParts.
        </p>
        <Button onClick={signIn}>
          <LogIn /> Sign in to BearParts
        </Button>
      </div>,
    );
  }

  if (status && !status.configured) {
    return shell(
      <p className="pt-8 text-center text-muted-foreground">
        Onshape integration isn&apos;t configured on the server yet.
      </p>,
    );
  }

  if (status && !connected) {
    return shell(
      <div className="space-y-3 pt-8 text-center">
        <p className="text-muted-foreground">
          Connect your Onshape account so BearParts can read this document.
        </p>
        <Button
          onClick={() => {
            window.open(`${location.origin}/api/onshape/auth?next=/integrations`, "_blank");
          }}
        >
          Connect Onshape
        </Button>
        <Button variant="ghost" size="sm" onClick={loadStudio}>
          <RefreshCw /> I&apos;ve connected — retry
        </Button>
      </div>,
    );
  }

  if (!ctx) {
    return shell(
      <p className="pt-8 text-center text-muted-foreground">
        Open this panel from inside an Onshape Part Studio.
      </p>,
    );
  }

  if (result) {
    return shell(
      <div className="space-y-3 pt-6 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-5" />
        </span>
        <p className="font-medium">&quot;{name}&quot; is in the library</p>
        {result.queuedPartId && (
          <p className="text-muted-foreground">It&apos;s also on the fab queue.</p>
        )}
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={`/library/parts/${result.libraryPartId}`}
                target="_blank"
                rel="noreferrer"
              />
            }
            nativeButton={false}
          >
            <ExternalLink /> Open in BearParts
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setResult(null);
            }}
          >
            Send another part
          </Button>
        </div>
      </div>,
    );
  }

  return shell(
    <>
      {loadError && (
        <Card className="gap-2 p-3">
          <p className="text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadStudio}>
            <RefreshCw /> Retry
          </Button>
        </Card>
      )}

      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Manufacturing handoff
        </p>
        <h1 className="text-base font-semibold">Send a part to the shop</h1>
        {studio && (
          <p className="truncate text-xs text-muted-foreground">
            {studio.documentName} · {studio.elementName}
          </p>
        )}
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as ExportMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="dxf" className="flex-1 gap-1.5">
            <FileText className="size-3.5" /> DXF <span className="text-muted-foreground">· flat face</span>
          </TabsTrigger>
          <TabsTrigger value="step" className="flex-1 gap-1.5">
            <Box className="size-3.5" /> STEP <span className="text-muted-foreground">· 3D part</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 1 — pick the part */}
      <Card className="gap-2 p-3">
        <p className="font-medium">1 · Part</p>
        {!studio ? (
          <Skeleton className="h-9 w-full" />
        ) : studio.parts.length === 0 ? (
          <p className="text-muted-foreground">No parts in this Part Studio.</p>
        ) : (
          <div className="flex items-start gap-2.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <Box className="size-6 opacity-30" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Select
                value={partId}
                items={studio.parts.map((p) => ({ value: p.partId, label: p.name }))}
                onValueChange={(v) => {
                  setPickedPartId(v);
                  setPickedFaceId(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a part" />
                </SelectTrigger>
                <SelectContent>
                  {studio.parts.map((p) => (
                    <SelectItem key={p.partId} value={p.partId}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {embedded && (
                <p className="text-xs text-muted-foreground">
                  or click a part in the graphics area
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 2 — DXF face */}
      {mode === "dxf" && partId && (
        <Card className="gap-2 p-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 font-medium">2 · Flat face</p>
            {embedded && (
              <Button variant="outline" size="sm" onClick={requestFaceSelection}>
                <MousePointerClick /> Pick in Onshape
              </Button>
            )}
          </div>
          {!faces ? (
            <Skeleton className="h-9 w-full" />
          ) : faces.length === 0 ? (
            <p className="text-muted-foreground">No planar faces on this part.</p>
          ) : (
            <Select
              value={faceId}
              items={faces.map((f) => ({
                value: f.faceId,
                label: `${fmtIn(f.width)} × ${fmtIn(f.height)} in`,
              }))}
              onValueChange={(v) => setPickedFaceId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a face" />
              </SelectTrigger>
              <SelectContent>
                {faces.map((f, i) => (
                  <SelectItem key={f.faceId} value={f.faceId}>
                    {`Face ${i + 1} — ${fmtIn(f.width)} × ${fmtIn(f.height)} in`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {face && (
            <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              Stock envelope{" "}
              <span className="font-medium text-foreground">
                {fmtIn(face.width)} × {fmtIn(face.height)} in
              </span>
            </p>
          )}
        </Card>
      )}

      {/* 3 — details */}
      <Card className="gap-2.5 p-3">
        <p className="font-medium">{mode === "dxf" ? "3" : "2"} · Details</p>
        <div className="space-y-1.5">
          <Label>Part name</Label>
          <Input
            value={name}
            onChange={(e) => setNameEdit({ key: partId, value: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Material</Label>
            <Input
              value={material}
              placeholder="e.g. 6061"
              onChange={(e) => setMaterialEdit({ key: partId, value: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Thickness (in)</Label>
            <Input
              value={thickness}
              placeholder="0.25"
              inputMode="decimal"
              onChange={(e) => setThickness(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Subsystem</Label>
          <Select
            value={subsystemId}
            items={subsystems.map((s) => ({
              value: s.id,
              label: s.projectName ? `${s.name} (${s.projectName})` : s.name,
            }))}
            onValueChange={(v) => setSubsystemPick(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Onshape imports folder" />
            </SelectTrigger>
            <SelectContent>
              {subsystems.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.projectName ? `${s.name} (${s.projectName})` : s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pt-1">
          <Checkbox checked={queue} onCheckedChange={(c) => setQueue(c === true)} />
          <span>Add to fab queue</span>
        </label>
        {queue && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Flow</Label>
              <Select
                value={fabMethod}
                items={PART_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                onValueChange={(v) => v && setMethodPick({ mode, value: v as PartMethod })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PART_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>

      <Button className="w-full" disabled={!canSubmit} onClick={submit}>
        {busy === "exporting" ? (
          <>
            <Loader2 className="animate-spin" /> Exporting from Onshape…
          </>
        ) : busy === "importing" ? (
          <>
            <Loader2 className="animate-spin" /> Uploading to BearParts…
          </>
        ) : (
          <>
            <Send /> Send to BearParts
          </>
        )}
      </Button>
    </>,
  );
}
