import type { Database } from "./database";
import type { DxfAnalysis } from "./analysis";

export type PartRow = Database["public"]["Tables"]["parts"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type PartStatus = "queued" | "assigned" | "in_progress" | "done" | "rejected";
export type PartPriority = "low" | "normal" | "high" | "urgent";
export type PartFileType = "dxf" | "stl" | "pdf" | "step";

/** Part joined with the profiles the UI always needs. */
export interface Part extends Omit<PartRow, "analysis"> {
  analysis: DxfAnalysis | null;
  submitter: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
  assignee: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
  source_version: {
    id: string;
    version: number;
    library_part: { id: string; name: string } | null;
  } | null;
}

export const PART_STATUSES: { value: PartStatus; label: string }[] = [
  { value: "queued", label: "Queued" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "rejected", label: "Rejected" },
];

export const PART_PRIORITIES: { value: PartPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
