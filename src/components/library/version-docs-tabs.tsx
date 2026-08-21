"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Plus, Route, X } from "lucide-react";
import type { VersionDocumentRow, DocumentKind } from "@/services/version-documents.service";
import { GCODE_EXTENSIONS } from "@/services/version-documents.service";
import {
  addVersionDocumentAction,
  deleteVersionDocumentAction,
} from "@/app/actions/library";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl, getDownloadUrl } from "@/services/storage.service";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfWorkspace } from "@/components/viewer/pdf-workspace";
import { GcodeWorkspace } from "@/components/viewer/gcode-workspace";

interface Props {
  initialDocs: VersionDocumentRow[];
  /**
   * Upload/delete are enabled only when the owning version is provided —
   * read-only surfaces (fab queue detail) omit it.
   */
  editable?: { versionId: string; versionNumber: number; libraryPartId: string };
  /** the model viewer for this version */
  children: React.ReactNode;
}

/** Model / Drawings / G-code tabs on a version's preview panel. */
export function VersionDocsTabs({ initialDocs, editable, children }: Props) {
  const [docs, setDocs] = useState(initialDocs);
  const drawings = docs.filter((d) => d.kind === "drawing");
  const gcode = docs.filter((d) => d.kind === "gcode");

  const upload = async (file: File) => {
    if (!editable) return;
    const formData = new FormData();
    formData.set("versionId", editable.versionId);
    formData.set("libraryPartId", editable.libraryPartId);
    formData.set("version", String(editable.versionNumber));
    formData.set("file", file);
    const doc = await addVersionDocumentAction(formData);
    setDocs((list) => [...list, doc]);
    toast.success(`${file.name} attached to v${editable.versionNumber}`);
  };

  const remove = (doc: VersionDocumentRow) => {
    if (!editable) return;
    setDocs((list) => list.filter((d) => d.id !== doc.id));
    deleteVersionDocumentAction(doc.id, editable.libraryPartId).catch(() => {
      toast.error("Could not delete document");
      setDocs((list) => [...list, doc]);
    });
  };

  return (
    <Tabs defaultValue="model">
      <TabsList>
        <TabsTrigger value="model" className="px-3">
          Model
        </TabsTrigger>
        <TabsTrigger value="drawing" className="px-3">
          Drawings{drawings.length > 0 && <Count n={drawings.length} />}
        </TabsTrigger>
        <TabsTrigger value="gcode" className="px-3">
          G-code{gcode.length > 0 && <Count n={gcode.length} />}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="model">{children}</TabsContent>
      <TabsContent value="drawing">
        <DocPanel
          kind="drawing"
          docs={drawings}
          onUpload={editable ? upload : undefined}
          onRemove={editable ? remove : undefined}
        />
      </TabsContent>
      <TabsContent value="gcode">
        <DocPanel
          kind="gcode"
          docs={gcode}
          onUpload={editable ? upload : undefined}
          onRemove={editable ? remove : undefined}
        />
      </TabsContent>
    </Tabs>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 text-xs tabular-nums text-muted-foreground">{n}</span>;
}

const KIND_META: Record<DocumentKind, { accept: string; add: string; empty: string }> = {
  drawing: { accept: ".pdf", add: "Add drawing", empty: "No drawings for this version yet." },
  gcode: {
    accept: GCODE_EXTENSIONS.join(","),
    add: "Add G-code",
    empty: "No G-code for this version yet.",
  },
};

/** File list + inline preview of the selected document. */
function DocPanel({
  kind,
  docs,
  onUpload,
  onRemove,
}: {
  kind: DocumentKind;
  docs: VersionDocumentRow[];
  onUpload?: (file: File) => Promise<void>;
  onRemove?: (doc: VersionDocumentRow) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.id ?? null);
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0] ?? null;

  const pick = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const download = async (doc: VersionDocumentRow) => {
    try {
      const url = await getDownloadUrl(createClient(), doc.path, doc.file_name);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Could not download");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {docs.map((doc) => (
          <span
            key={doc.id}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-2.5 text-xs transition-colors",
              doc.id === selected?.id
                ? "border-primary/40 bg-primary/5 font-medium"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <button
              type="button"
              title={doc.file_name}
              onClick={() => setSelectedId(doc.id)}
              className="flex min-w-0 items-center gap-1.5"
            >
              {kind === "drawing" ? (
                <FileText className="size-3.5 shrink-0" />
              ) : (
                <Route className="size-3.5 shrink-0" />
              )}
              <span className="max-w-44 truncate">{doc.file_name}</span>
              <span className="shrink-0 text-muted-foreground">{formatBytes(doc.size_bytes)}</span>
            </button>
            <button
              type="button"
              aria-label={`Download ${doc.file_name}`}
              onClick={() => download(doc)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
            </button>
            {onRemove && (
              <button
                type="button"
                aria-label={`Delete ${doc.file_name}`}
                onClick={() => onRemove(doc)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}

        {onUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={KIND_META[kind].accept}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
              {KIND_META[kind].add}
            </Button>
          </>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
          {kind === "drawing" ? (
            <FileText className="mb-1 size-8 opacity-40" />
          ) : (
            <Route className="mb-1 size-8 opacity-40" />
          )}
          {KIND_META[kind].empty}
        </div>
      ) : (
        selected && <DocPreview key={selected.id} doc={selected} />
      )}
    </div>
  );
}

/** Fetches the file and renders the right viewer (keyed by doc id — no stale state). */
function DocPreview({ doc }: { doc: VersionDocumentRow }) {
  const [content, setContent] = useState<{ text?: string; buffer?: ArrayBuffer } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await getFileUrl(createClient(), doc.path);
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const value =
          doc.kind === "gcode" ? { text: await res.text() } : { buffer: await res.arrayBuffer() };
        if (!cancelled) setContent(value);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (failed) {
    return <p className="text-sm text-destructive">Could not load this document.</p>;
  }
  if (!content) return <Skeleton className="h-72 w-full" />;
  if (content.text !== undefined) return <GcodeWorkspace gcodeText={content.text} />;
  return <PdfWorkspace pdfBuffer={content.buffer!} />;
}
