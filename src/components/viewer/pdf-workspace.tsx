"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// pdf.js is heavy — load only when a PDF is on screen
const PdfViewer = dynamic(() => import("./pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[55svh] min-h-64 w-full lg:h-[60svh]" />,
});

/** Drawing viewer for PDF parts — no analysis, printers and humans read these. */
export function PdfWorkspace({ pdfBuffer }: { pdfBuffer: ArrayBuffer }) {
  return <PdfViewer data={pdfBuffer} className="h-[55svh] min-h-64 lg:h-[60svh]" />;
}
