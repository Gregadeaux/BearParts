"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { addVersionAction } from "@/app/actions/library";
import { UploadDropzone } from "@/components/parts/upload-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Append the next version of an existing library part. */
export function UploadVersionDialog({ libraryPartId }: { libraryPartId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      if (!file) return;
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("libraryPartId", libraryPartId);
        formData.set("note", note);
        const { version } = await addVersionAction(formData);
        toast.success(`v${version} uploaded`);
        setOpen(false);
        router.refresh();
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
          setNote("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" nativeButton />}>
        <FilePlus2 /> New version
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload new version</DialogTitle>
        </DialogHeader>
        {!file ? (
          <UploadDropzone onFile={setFile} />
        ) : (
          <div className="space-y-3">
            <p className="truncate rounded-md bg-muted px-3 py-2 text-sm">{file.name}</p>
            <div className="space-y-1.5">
              <Label>What changed?</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Moved bearing hole 0.25 in; added lightening pockets"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={pending} onClick={submit}>
                {pending ? "Uploading…" : "Upload version"}
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
