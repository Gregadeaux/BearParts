"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Blocks, Folder, Search } from "lucide-react";
import type { FolderRow, LibraryPartListing } from "@/types/library";
import type { PartFileType } from "@/types/part";
import type { ProjectRow } from "@/types/task";
import type { Subsystem } from "@/services/subsystems.service";
import { deleteFolderAction, deleteLibraryPartAction } from "@/app/actions/library";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FavoriteStar } from "./favorite-star";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { LibraryPartTile } from "./library-part-tile";
import { NewFolderDialog } from "./new-folder-dialog";
import { NewSubsystemDialog } from "./new-subsystem-dialog";
import { UploadPartDialog } from "./upload-part-dialog";
import { useLibrarySearch } from "./use-library-search";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "dxf", label: "DXF" },
  { value: "stl", label: "STL" },
  { value: "pdf", label: "PDF" },
  { value: "step", label: "STEP" },
];

interface Props {
  currentFolderId: string | null;
  ancestry: FolderRow[];
  folders: FolderRow[];
  parts: LibraryPartListing[];
  subsystems: Subsystem[];
  projects: ProjectRow[];
  /** part id → signed URL of the latest version's preview PNG */
  thumbUrls?: Record<string, string>;
  /** folder links become `${basePath}?f=<id>` — defaults to the library page */
  basePath?: string;
  /** embedded in a subsystem dashboard: no Library root crumb, no subsystem tools */
  embedded?: boolean;
  /** the signed-in user's favorite folder ids — enables the star toggle */
  favoriteFolderIds?: string[];
}

/** Folder browser with whole-library search and type filtering. */
export function LibraryBrowser({
  currentFolderId,
  ancestry,
  folders,
  parts,
  subsystems,
  projects,
  thumbUrls = {},
  basePath = "/library",
  embedded = false,
  favoriteFolderIds,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PartFileType | "all">("all");
  const [deletingPart, setDeletingPart] = useState<LibraryPartListing | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const search = useLibrarySearch(query, currentFolderId);

  const matchesType = (p: LibraryPartListing) =>
    typeFilter === "all" || p.latest?.file_type === typeFilter;

  const deleteFolder = async (folder: FolderRow) => {
    try {
      await deleteFolderAction(folder.id);
      toast.success(`Deleted "${folder.name}"`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete folder");
    }
  };

  const deletePart = async () => {
    if (!deletingPart) return;
    setDeletePending(true);
    try {
      await deleteLibraryPartAction(deletingPart.id);
      toast.success(`Deleted "${deletingPart.name}"`);
      setDeletingPart(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete part");
    } finally {
      setDeletePending(false);
    }
  };

  const searching = query.trim().length >= 2;
  const subsystemByFolder = new Map(subsystems.map((s) => [s.folder_id, s]));
  const currentFolder = ancestry[ancestry.length - 1];
  const currentSubsystem = currentFolderId ? subsystemByFolder.get(currentFolderId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LibraryBreadcrumb
          ancestry={ancestry}
          basePath={basePath}
          root={embedded ? null : undefined}
          subsystemsByFolder={Object.fromEntries(subsystems.map((s) => [s.folder_id, s.id]))}
        />
        <div className="ml-auto flex gap-2">
          {currentFolderId && !embedded && favoriteFolderIds && (
            <FavoriteStar
              folderId={currentFolderId}
              initialFavorite={favoriteFolderIds.includes(currentFolderId)}
            />
          )}
          {currentFolderId &&
            !embedded &&
            (currentSubsystem ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/subsystems/${currentSubsystem.id}`} />}
              >
                <Blocks /> {currentSubsystem.name}
              </Button>
            ) : (
              <NewSubsystemDialog
                folderId={currentFolderId}
                folderName={currentFolder?.name ?? "This folder"}
                projects={projects}
              />
            ))}
          <NewFolderDialog parentId={currentFolderId} />
          {currentFolderId && <UploadPartDialog folderId={currentFolderId} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={currentFolderId ? "Search this folder…" : "Search the library…"}
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter((v as PartFileType | "all") ?? "all")}
          items={TYPE_OPTIONS}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {searching ? (
        <SearchResults
          results={search.results}
          searching={search.searching}
          thumbUrls={search.thumbUrls}
          matchesType={matchesType}
          basePath={basePath}
          onDeletePart={setDeletingPart}
        />
      ) : (
        <BrowseGrid
          currentFolderId={currentFolderId}
          folders={folders}
          parts={parts.filter(matchesType)}
          typeFiltered={typeFilter !== "all" && parts.length > 0}
          thumbUrls={thumbUrls}
          subsystemByFolder={subsystemByFolder}
          onDeleteFolder={deleteFolder}
          basePath={basePath}
          onDeletePart={setDeletingPart}
        />
      )}

      <AlertDialog open={deletingPart !== null} onOpenChange={(open) => !open && setDeletingPart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete part?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deletingPart?.name}</span> and all{" "}
              {deletingPart?.versionCount ?? 0} version
              {(deletingPart?.versionCount ?? 0) === 1 ? "" : "s"} will be removed for good,
              including its comments. Fab-queue entries made from it are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deletePending} onClick={deletePart}>
              {deletePending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BrowseGrid({
  currentFolderId,
  folders,
  parts,
  typeFiltered,
  thumbUrls,
  subsystemByFolder,
  onDeleteFolder,
  basePath,
  onDeletePart,
}: {
  currentFolderId: string | null;
  folders: FolderRow[];
  parts: LibraryPartListing[];
  /** the type filter is hiding parts that exist here */
  typeFiltered: boolean;
  thumbUrls: Record<string, string>;
  subsystemByFolder: Map<string, Subsystem>;
  onDeleteFolder: (folder: FolderRow) => void;
  basePath: string;
  onDeletePart: (part: LibraryPartListing) => void;
}) {
  if (folders.length === 0 && parts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-sm text-muted-foreground">
        <Folder className="mb-1 size-8 opacity-40" />
        {typeFiltered
          ? "No parts of that type in this folder."
          : currentFolderId
            ? "Nothing in this folder yet."
            : "No folders yet."}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {folders.map((folder) => (
        <ContextMenu key={folder.id}>
          <ContextMenuTrigger>
            {/* subsystem folders open their dashboard; plain folders browse in place */}
            <Link
              href={
                subsystemByFolder.has(folder.id)
                  ? `/subsystems/${subsystemByFolder.get(folder.id)!.id}`
                  : `${basePath}?f=${folder.id}`
              }
              className="block"
            >
              <Card className="flex-row items-center gap-2.5 border-transparent bg-muted/60 p-3 transition-colors hover:bg-muted">
                <Folder className="size-5 shrink-0 fill-amber-200 text-amber-500" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
                {subsystemByFolder.has(folder.id) && (
                  <Blocks
                    className="size-4 shrink-0 text-violet-500"
                    aria-label="Subsystem"
                  />
                )}
              </Card>
            </Link>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem variant="destructive" onClick={() => onDeleteFolder(folder)}>
              Delete folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      {parts.map((part) => (
        <ContextMenu key={part.id}>
          <ContextMenuTrigger>
            <LibraryPartTile part={part} thumbUrl={thumbUrls[part.id]} />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem variant="destructive" onClick={() => onDeletePart(part)}>
              Delete part
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}

function SearchResults({
  results,
  searching,
  thumbUrls,
  matchesType,
  basePath,
  onDeletePart,
}: {
  results: ReturnType<typeof useLibrarySearch>["results"];
  searching: boolean;
  thumbUrls: Record<string, string>;
  matchesType: (p: LibraryPartListing) => boolean;
  basePath: string;
  onDeletePart: (part: LibraryPartListing) => void;
}) {
  if (!results) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Searching…</p>;
  }
  const parts = results.parts.filter(matchesType);

  return (
    <div className="space-y-4">
      {results.folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {results.folders.map((folder) => (
            <Link
              key={folder.id}
              href={`${basePath}?f=${folder.id}`}
              className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border bg-muted/50 px-3 py-1 text-sm transition-colors hover:bg-muted"
            >
              <Folder className="size-3.5 shrink-0 fill-amber-200 text-amber-500" />
              {folder.name}
            </Link>
          ))}
        </div>
      )}
      {parts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {searching ? "Searching…" : "No matching parts."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {parts.map((part) => (
            <ContextMenu key={part.id}>
              <ContextMenuTrigger>
                <LibraryPartTile
                  part={part}
                  thumbUrl={thumbUrls[part.id]}
                  folderName={part.folderName}
                />
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem variant="destructive" onClick={() => onDeletePart(part)}>
                  Delete part
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}
    </div>
  );
}
