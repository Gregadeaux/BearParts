"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Folder, Search } from "lucide-react";
import type { FolderRow, LibraryPartListing } from "@/types/library";
import type { PartFileType } from "@/types/part";
import { deleteFolderAction } from "@/app/actions/library";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { LibraryPartTile } from "./library-part-tile";
import { NewFolderDialog } from "./new-folder-dialog";
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
];

interface Props {
  currentFolderId: string | null;
  ancestry: FolderRow[];
  folders: FolderRow[];
  parts: LibraryPartListing[];
  /** part id → signed URL of the latest version's preview PNG */
  thumbUrls?: Record<string, string>;
}

/** Folder browser with whole-library search and type filtering. */
export function LibraryBrowser({ currentFolderId, ancestry, folders, parts, thumbUrls = {} }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PartFileType | "all">("all");
  const search = useLibrarySearch(query);

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

  const searching = query.trim().length >= 2;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LibraryBreadcrumb ancestry={ancestry} />
        <div className="ml-auto flex gap-2">
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
            placeholder="Search the whole library…"
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
        />
      ) : (
        <BrowseGrid
          currentFolderId={currentFolderId}
          folders={folders}
          parts={parts.filter(matchesType)}
          thumbUrls={thumbUrls}
          onDeleteFolder={deleteFolder}
        />
      )}
    </div>
  );
}

function BrowseGrid({
  currentFolderId,
  folders,
  parts,
  thumbUrls,
  onDeleteFolder,
}: {
  currentFolderId: string | null;
  folders: FolderRow[];
  parts: LibraryPartListing[];
  thumbUrls: Record<string, string>;
  onDeleteFolder: (folder: FolderRow) => void;
}) {
  if (folders.length === 0 && parts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-sm text-muted-foreground">
        <Folder className="mb-1 size-8 opacity-40" />
        {currentFolderId ? "Nothing in this folder yet." : "No folders yet."}
      </div>
    );
  }
  return (
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
            <ContextMenuItem variant="destructive" onClick={() => onDeleteFolder(folder)}>
              Delete folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      {parts.map((part) => (
        <LibraryPartTile key={part.id} part={part} thumbUrl={thumbUrls[part.id]} />
      ))}
    </div>
  );
}

function SearchResults({
  results,
  searching,
  thumbUrls,
  matchesType,
}: {
  results: ReturnType<typeof useLibrarySearch>["results"];
  searching: boolean;
  thumbUrls: Record<string, string>;
  matchesType: (p: LibraryPartListing) => boolean;
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
              href={`/library?f=${folder.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-sm transition-colors hover:bg-muted"
            >
              <Folder className="size-3.5 fill-amber-200 text-amber-500" />
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
            <LibraryPartTile
              key={part.id}
              part={part}
              thumbUrl={thumbUrls[part.id]}
              folderName={part.folderName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
