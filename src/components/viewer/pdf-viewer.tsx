"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Expand, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** PDF bytes — cloned internally (pdf.js detaches the buffer it's given) */
  data: ArrayBuffer;
  className?: string;
}

/** pdf.js canvas viewer: page nav + zoom, scroll to pan. Mobile-safe. */
export function PdfViewer({ data, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1); // multiplier on fit-width
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = pdfjs.getDocument({ data: data.slice(0) });
        const loaded = await task.promise;
        if (!cancelled) {
          setDoc(loaded);
          setPage(1);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [data]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      const pdfPage = await doc.getPage(page);
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas || cancelled) return;

      const base = pdfPage.getViewport({ scale: 1 });
      const fitWidth = (container.clientWidth - 16) / base.width;
      const scale = fitWidth * zoom;
      const dpr = window.devicePixelRatio || 1;
      const viewport = pdfPage.getViewport({ scale });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page, zoom]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        Could not read this PDF.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-muted/30 ${className ?? ""}`}>
      <div ref={containerRef} className="h-full overflow-auto p-2">
        <canvas ref={canvasRef} className="mx-auto rounded shadow-sm" />
      </div>

      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <Button variant="secondary" size="icon" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((z) => Math.min(z * 1.4, 8))}>
          <Plus />
        </Button>
        <Button variant="secondary" size="icon" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(z / 1.4, 1))}>
          <Minus />
        </Button>
        <Button variant="secondary" size="icon" aria-label="Fit width" title="Fit width" onClick={() => setZoom(1)}>
          <Expand />
        </Button>
      </div>

      {doc && doc.numPages > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 text-sm shadow backdrop-blur">
          <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft />
          </Button>
          <span className="tabular-nums text-xs">
            {page} / {doc.numPages}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= doc.numPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
