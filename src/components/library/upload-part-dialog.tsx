"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import type { PartFileType } from "@/types/part";
import { createLibraryPartAction } from "@/app/actions/library";
import { generateThumbnail } from "@/lib/thumbnails";
import { formatBytes } from "@/lib/format";
import { UploadDropzone } from "@/components/parts/upload-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Upload a new part (v1) into the current folder. */
export function UploadPartDialog({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<PartFileType>("dxf");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      if (!file) return;
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("folderId", folderId);
        formData.set("name", name);
        const thumb = await generateThumbnail(file, fileType);
        if (thumb) formData.set("thumb", new File([thumb], "thumb.png", { type: "image/png" }));
        const { id } = await createLibraryPartAction(formData);
        toast.success("Part added to library");
        setOpen(false);
        router.push(`/library/parts/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setFile(null);
          setName("");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" nativeButton />}>
        <Upload /> Upload part
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload part</DialogTitle>
        </DialogHeader>
        {!file ? (
          <UploadDropzone
            onFile={(f, type) => {
              setFile(f);
              setFileType(type);
              if (!name) setName(f.name.replace(/\.(dxf|stl|pdf|step|stp)$/i, ""));
            }}
          />
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(file.size)}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label>Part name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button disabled={pending || !name.trim()} onClick={submit}>
                {pending ? "Uploading…" : "Add to library"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setFile(null)}>
                Different file
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
