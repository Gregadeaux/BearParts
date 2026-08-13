import type { Database } from "./database";
import type { DxfAnalysis, Units } from "./analysis";
import type { PartFileType, ProfileRow } from "./part";

export type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
export type LibraryPartRow = Database["public"]["Tables"]["library_parts"]["Row"];
export type PartVersionRow = Database["public"]["Tables"]["part_versions"]["Row"];

type Person = Pick<ProfileRow, "id" | "display_name" | "avatar_url">;

/** A file version with typed analysis and its uploader. */
export interface PartVersion extends Omit<PartVersionRow, "analysis" | "file_type" | "units"> {
  analysis: DxfAnalysis | null;
  file_type: PartFileType;
  units: Units;
  uploader: Person | null;
}

/** Library part as listed in a folder — carries its latest version. */
export interface LibraryPartListing extends LibraryPartRow {
  latest: PartVersion | null;
  versionCount: number;
}

/** Full detail: every version (latest first) plus fab-queue history. */
export interface LibraryPartDetail extends LibraryPartRow {
  versions: PartVersion[];
  queueEntries: {
    id: string;
    status: string;
    quantity: number;
    created_at: string;
    source_version_id: string | null;
    assignee: Person | null;
  }[];
}
