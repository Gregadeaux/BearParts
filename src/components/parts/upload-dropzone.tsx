"use client";

import { useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
}

/** Drag-and-drop / tap-to-browse target for DXF files. */
export function UploadDropzone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".dxf")) return;
    onFile(file);
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
      <span className="font-medium">Drop a DXF here</span>
      <span className="text-xs text-muted-foreground">or tap to browse</span>
      <input
        ref={inputRef}
        type="file"
        accept=".dxf"
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />
    </button>
  );
}
