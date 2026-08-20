"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { PreviewKind } from "@/types/task";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DxfWorkspace } from "./dxf-workspace";
import { StlWorkspace } from "./stl-workspace";
import { PdfWorkspace } from "./pdf-workspace";

export interface PreviewFile {
  fileName: string;
  kind: PreviewKind;
  /** URL to fetch the file content from (signed URL or object URL) */
  src: string;
  /** URL that forces a download; falls back to src */
  downloadUrl?: string;
}

interface Props {
  file: PreviewFile | null;
  onClose: () => void;
}

/** Modal preview for DXF/STL/PDF attachments, with a download button. */
export function FilePreviewDialog({ file, onClose }: Props) {
  // keyed by src so switching files never shows stale content — no reset-in-effect needed
  const [result, setResult] = useState<{ src: string; data: string | ArrayBuffer } | null>(null);
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let stale = false;
    fetch(file.src)
      .then((r): Promise<string | ArrayBuffer> => {
        if (!r.ok) return Promise.reject(new Error("fetch failed"));
        return file.kind === "dxf" ? r.text() : r.arrayBuffer();
      })
      .then((data) => !stale && setResult({ src: file.src, data }))
      .catch(() => !stale && setErrorSrc(file.src));
    return () => {
      stale = true;
    };
  }, [file]);

  const loaded = file && result?.src === file.src ? result.data : null;
  const error = file !== null && errorSrc === file.src;

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-3 sm:max-w-5xl">
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle className="min-w-0 truncate text-base">{file?.fileName}</DialogTitle>
          {file && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              nativeButton={false}
              render={<a href={file.downloadUrl ?? file.src} download={file.fileName} />}
            >
              <Download /> Download
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">Could not load this file.</p>
          ) : !file || loaded === null ? (
            <Skeleton className="h-72 w-full" />
          ) : file.kind === "stl" ? (
            <StlWorkspace stlBuffer={loaded as ArrayBuffer} />
          ) : file.kind === "pdf" ? (
            <PdfWorkspace pdfBuffer={loaded as ArrayBuffer} />
          ) : (
            <DxfWorkspace dxfText={loaded as string} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
