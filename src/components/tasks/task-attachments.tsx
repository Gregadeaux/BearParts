"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Eye, FileText, Loader2, Paperclip, X } from "lucide-react";
import { previewKind, type TaskAttachment } from "@/types/task";
import {
  addTaskAttachmentAction,
  attachmentUrlsAction,
  deleteTaskAttachmentAction,
} from "@/app/actions/tasks";
import { randomId } from "@/lib/id";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FilePreviewDialog, type PreviewFile } from "@/components/viewer/file-preview-dialog";

/** Saved attachment, or a staged local file waiting for the task to be created. */
export interface AttachmentItem {
  id: string;
  file_name: string;
  size_bytes: number;
  staged?: File;
}

export function toItem(attachment: TaskAttachment): AttachmentItem {
  return { id: attachment.id, file_name: attachment.file_name, size_bytes: attachment.size_bytes };
}

interface Props {
  /** null while creating — files are staged locally and uploaded on save */
  taskId: string | null;
  items: AttachmentItem[];
  onItemsChange: (update: (items: AttachmentItem[]) => AttachmentItem[]) => void;
}

/** Attachment list in the task dialog: upload anything, preview dxf/stl/pdf, download. */
export function TaskAttachments({ taskId, items, onItemsChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!taskId) {
      onItemsChange((list) => [
        ...list,
        ...files.map((file) => ({ id: randomId(), file_name: file.name, size_bytes: file.size, staged: file })),
      ]);
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("taskId", taskId);
        formData.set("file", file);
        const saved = await addTaskAttachmentAction(formData);
        onItemsChange((list) => [...list, toItem(saved)]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = (item: AttachmentItem) => {
    onItemsChange((list) => list.filter((x) => x.id !== item.id));
    if (item.staged || !taskId) return;
    deleteTaskAttachmentAction(item.id).catch(() => {
      toast.error("Could not delete attachment");
      onItemsChange((list) => [...list, item]);
    });
  };

  /** Signed URLs for saved files, object URL for staged ones. */
  const urlsFor = async (item: AttachmentItem) => {
    if (item.staged) {
      const url = URL.createObjectURL(item.staged);
      return { viewUrl: url, downloadUrl: url };
    }
    return attachmentUrlsAction(item.id);
  };

  const open = async (item: AttachmentItem) => {
    const kind = previewKind(item.file_name);
    try {
      const { viewUrl, downloadUrl } = await urlsFor(item);
      if (kind) setPreview({ fileName: item.file_name, kind, src: viewUrl, downloadUrl });
      else triggerDownload(downloadUrl, item.file_name);
    } catch {
      toast.error("Could not open attachment");
    }
  };

  const download = async (item: AttachmentItem) => {
    try {
      const { downloadUrl } = await urlsFor(item);
      triggerDownload(downloadUrl, item.file_name);
    } catch {
      toast.error("Could not download attachment");
    }
  };

  const closePreview = () => {
    if (preview?.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
    setPreview(null);
  };

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">
        Attachments
        {items.length > 0 && <span className="ml-1.5 tabular-nums">{items.length}</span>}
      </span>

      {items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map((item) => {
            const kind = previewKind(item.file_name);
            return (
              <li
                key={item.id}
                className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  title={kind ? "Preview" : "Download"}
                >
                  {item.file_name}
                </button>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatBytes(item.size_bytes)}
                </span>
                {item.staged && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">on save</span>
                )}
                <span className="hidden shrink-0 items-center gap-1.5 group-hover:flex">
                  {kind && (
                    <button
                      type="button"
                      aria-label={`Preview ${item.file_name}`}
                      onClick={() => open(item)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Download ${item.file_name}`}
                    onClick={() => download(item)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.file_name}`}
                    onClick={() => remove(item)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="h-7 px-1 text-muted-foreground"
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
        {uploading ? "Uploading…" : "Attach files"}
      </Button>

      <FilePreviewDialog file={preview} onClose={closePreview} />
    </div>
  );
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
