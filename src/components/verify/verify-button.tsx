"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ruler } from "lucide-react";
import type { Part } from "@/types/part";
import type { AnalyzedDxf } from "@/services/dxf/analysis.service";
import type { StlMesh } from "@/services/stl/stl-parser";
import { isVerifiable } from "@/services/dimensions/part-dimensions";
import { modelScaleToInches } from "@/services/dimensions/model-size";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useKeyDimensions } from "./use-key-dimensions";
import { VerifyFlow } from "./verify-flow";
import type { FigureSource } from "./dimension-figure";

interface Props {
  part: Part;
  /** the page's DXF parse (DxfWorkspace) — profile for the figure */
  dxf: AnalyzedDxf | null;
  /** the page's STEP/STL mesh (3D viewer) — measured and drawn, never re-parsed */
  mesh: StlMesh | null;
  /** the page failed to download / read the file */
  fileError?: boolean;
}

/**
 * "Verify" — part in hand, calipers out. Full-screen on phones (top-anchored
 * so the keypad never covers the input), a regular dialog on desktop.
 */
export function VerifyButton({ part, dxf, mesh, fileError }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { dims, omittedHoles, error } = useKeyDimensions(part, {
    mesh,
    liveAnalysis: dxf?.analysis ?? null,
    active: open,
    fileError,
  });

  // PDFs, and DXFs whose analysis found nothing: no entry point at all
  if (!isVerifiable(part.file_type) || (dims !== null && dims.length === 0)) return null;

  const figure: FigureSource =
    part.file_type === "dxf"
      ? {
          kind: "dxf",
          entities: dxf?.entities ?? null,
          bbox: dxf?.analysis.boundingBox ?? part.analysis?.boundingBox ?? null,
        }
      : {
          kind: "model",
          mesh,
          inchesPerUnit: modelScaleToInches(part.file_type === "stl" ? "stl" : "step", part.units),
        };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" nativeButton />}>
        <Ruler /> Verify
      </DialogTrigger>
      <DialogContent className="grid-cols-1 content-start gap-3 sm:max-w-lg max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-none max-sm:pt-3">
        <DialogTitle className="truncate pr-8 leading-6">
          Verify <span className="font-normal text-muted-foreground">· {part.name}</span>
        </DialogTitle>
        <DialogDescription className="sr-only">Measure the part and compare to the model</DialogDescription>
        {error ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Couldn&apos;t read the model. No dimensions to check.
          </p>
        ) : dims === null ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading the model…
          </p>
        ) : (
          <VerifyFlow
            partId={part.id}
            dims={dims}
            omittedHoles={omittedHoles}
            figure={figure}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
