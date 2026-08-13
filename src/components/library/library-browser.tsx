"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Folder, FileText, Box } from "lucide-react";
import type { FolderRow, LibraryPartListing } from "@/types/library";
import { deleteFolderAction } from "@/app/actions/library";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { NewFolderDialog } from "./new-folder-dialog";
import { UploadPartDialog } from "./upload-part-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatDate } from "@/lib/format";

interface Props {
  currentFolderId: string | null;
  ancestry: FolderRow[];
  folders: FolderRow[];
  parts: LibraryPartListing[];
}

/** Folder browser: breadcrumb, toolbar, grid of folders + parts. */
export function LibraryBrowser({ currentFolderId, ancestry, folders, parts }: Props) {
  const router = useRouter();

  const deleteFolder = async (folder: FolderRow) => {
    try {
      await deleteFolderAction(folder.id);
      toast.success(`Deleted "${folder.name}"`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete folder");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LibraryBreadcrumb ancestry={ancestry} />
        <div className="ml-auto flex gap-2">
          <NewFolderDialog parentId={currentFolderId} />
          {currentFolderId && <UploadPartDialog folderId={currentFolderId} />}
        </div>
      </div>

      {folders.length === 0 && parts.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-16 text-sm text-muted-foreground">
          <Folder className="mb-1 size-8 opacity-40" />
          {currentFolderId ? "Nothing in this folder yet." : "No folders yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger>
                <Link href={`/library?f=${folder.id}`} className="block">
                  <Card className="flex-row items-center gap-2.5 border-transparent bg-muted/60 p-3 transition-colors hover:bg-muted">
                    <Folder className="size-5 shrink-0 fill-amber-200 text-amber-500" />
                    <span className="truncate text-sm font-medium">{folder.name}</span>
                  </Card>
                </Link>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem variant="destructive" onClick={() => deleteFolder(folder)}>
                  Delete folder
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {parts.map((part) => (
            <Link key={part.id} href={`/library/parts/${part.id}`} className="block">
              <Card className="gap-2 p-3 shadow-sm transition-all hover:bg-accent/50 hover:shadow-md">
                <div className="flex items-center gap-2.5">
                  {part.latest?.file_type === "stl" ? (
                    <Box className="size-5 shrink-0 text-violet-500" />
                  ) : (
                    <FileText className="size-5 shrink-0 text-sky-500" />
                  )}
                  <span className="truncate text-sm font-medium">{part.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {part.latest && <Badge variant="secondary">v{part.latest.version}</Badge>}
                  <span className="ml-auto">{formatDate(part.updated_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
