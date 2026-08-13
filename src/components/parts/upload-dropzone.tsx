"use client";

import { useRef, useState } from "react";
import type { PartFileType } from "@/types/part";

interface Props {
  onFile: (file: File, fileType: PartFileType) => void;
}

function fileTypeOf(name: string): PartFileType | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dxf")) return "dxf";
  if (lower.endsWith(".stl")) return "stl";
  return null;
}

/** Drag-and-drop / tap-to-browse target for DXF (machined) and STL (printed) parts. */
export function UploadDropzone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    const type = fileTypeOf(file.name);
    if (type) onFile(file, type);
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files[0]);
      }}
      className={`flex h-40 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <span className="text-3xl">📄</span>
      <span className="font-medium">Drop a DXF or STL here</span>
      <span className="text-xs text-muted-foreground">machined · 3D printed</span>
      <input
        ref={inputRef}
        type="file"
        accept=".dxf,.stl"
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />
    </button>
  );
}
