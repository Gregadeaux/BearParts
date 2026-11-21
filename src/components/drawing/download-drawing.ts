"use client";

import type { DrawingSource } from "@/types/drawing";
import type { DrawingInputs } from "@/services/drawing/generate";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl } from "@/services/storage.service";
import { drawingFileName } from "@/services/drawing/format";

/**
 * Fetch the part file, build the drawing, and save it. Everything heavy
 * (jsPDF, the layout engine, OpenCascade for STEP) is loaded on demand.
 */
export async function downloadDrawing(source: DrawingSource, inputs: DrawingInputs): Promise<void> {
  const res = await fetch(await getFileUrl(createClient(), source.filePath));
  if (!res.ok) throw new Error("Could not download the part file");
  const gen = await import("@/services/drawing/generate");

  let pdf: ArrayBuffer;
  if (source.fileType === "dxf") {
    pdf = gen.dxfDrawing(await res.text(), source, inputs).pdf;
  } else {
    const buffer = await res.arrayBuffer();
    const mesh =
      source.fileType === "step"
        ? await import("@/services/drawing/step-mesh").then((m) => m.stepMeshForDrawing(buffer))
        : { positions: (await import("@/services/stl/stl-parser")).parseStl(buffer).positions, faceIds: null };
    pdf = gen.meshDrawing(mesh.positions, source, inputs, mesh.faceIds).pdf;
  }

  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = drawingFileName(source.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
