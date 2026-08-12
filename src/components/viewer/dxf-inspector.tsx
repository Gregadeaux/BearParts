"use client";

import { useState } from "react";
import type { Units } from "@/types/analysis";
import { UploadDropzone } from "@/components/parts/upload-dropzone";
import { DxfWorkspace } from "./dxf-workspace";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Standalone client-only inspector: dropzone + workspace + unit override. */
export function DxfInspector() {
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [units, setUnits] = useState<Units | "auto">("auto");

  if (!dxfText) {
    return <UploadDropzone onFile={async (f) => setDxfText(await f.text())} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select
          value={units}
          onValueChange={(v) => setUnits(v as Units | "auto")}
          items={[
            { value: "auto", label: "Auto-detect" },
            { value: "in", label: "Inches" },
            { value: "mm", label: "Millimeters" },
          ]}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="in">Inches</SelectItem>
            <SelectItem value="mm">Millimeters</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={() => setDxfText(null)}>
          Different file
        </Button>
      </div>
      <DxfWorkspace dxfText={dxfText} unitOverride={units === "auto" ? undefined : units} />
    </div>
  );
}
