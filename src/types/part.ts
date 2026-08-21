import type { Database } from "./database";
import type { DxfAnalysis } from "./analysis";

export type PartRow = Database["public"]["Tables"]["parts"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type PartStatus =
  | "queued"
  | "toolpaths"
  | "slicing"
  | "saw"
  | "ready"
  | "in_progress"
  | "finishing"
  | "done"
  | "rejected";
export type PartMethod = "cnc" | "laser" | "manual" | "print";
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
  { value: "toolpaths", label: "Needs toolpaths" },
  { value: "slicing", label: "Needs slicing" },
  { value: "saw", label: "Cut to length" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In progress" },
  { value: "finishing", label: "Finishing" },
  { value: "done", label: "Done" },
  { value: "rejected", label: "Rejected" },
];

/** Each fabrication method walks its own subset of statuses, in this order. */
export const PART_METHODS: {
  value: PartMethod;
  label: string;
  lanes: PartStatus[];
}[] = [
  {
    value: "cnc",
    label: "CNC",
    lanes: ["queued", "toolpaths", "saw", "ready", "in_progress", "finishing", "done"],
  },
  { value: "laser", label: "Laser", lanes: ["queued", "in_progress", "done"] },
  { value: "manual", label: "Manual", lanes: ["queued", "in_progress", "done"] },
  { value: "print", label: "3DP", lanes: ["queued", "slicing", "ready", "in_progress", "done"] },
];

export const methodMeta = (method: string) =>
  PART_METHODS.find((m) => m.value === method) ?? PART_METHODS[2];

/** Sensible default flow for a file type (dxf→laser, step→cnc, stl→3DP). */
export const defaultMethodFor = (fileType: PartFileType): PartMethod =>
  fileType === "dxf" ? "laser" : fileType === "stl" ? "print" : fileType === "step" ? "cnc" : "manual";

export const PART_PRIORITIES: { value: PartPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
