import type { Database } from "./database";
import type { ProfileRow } from "./part";

export type SubgroupRow = Database["public"]["Tables"]["subgroups"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type Person = Pick<ProfileRow, "id" | "display_name" | "avatar_url">;

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskAttachment {
  id: string;
  file_name: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

/** File types with a built-in viewer — anything else is download-only. */
export type PreviewKind = "dxf" | "stl" | "pdf" | "step";

export function previewKind(fileName: string): PreviewKind | null {
  const ext = fileName.toLowerCase().match(/\.(dxf|stl|pdf|step|stp)$/)?.[1];
  if (!ext) return null;
  return ext === "stp" ? "step" : (ext as PreviewKind);
}

/** Task with everything the UI needs joined in. */
export interface Task extends Omit<TaskRow, "status"> {
  status: TaskStatus;
  subgroup: SubgroupRow | null;
  project: ProjectRow | null;
  assignees: Person[];
  tags: string[];
  subtasks: Subtask[];
  attachments: TaskAttachment[];
}

/** Fixed status set (see research spec) — subgroup owns hue, status stays a neutral dot. */
export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo", label: "Not started", color: "#94a3b8" },
  { value: "in_progress", label: "In progress", color: "#3b82f6" },
  { value: "blocked", label: "Blocked", color: "#ef4444" },
  { value: "done", label: "Done", color: "#10b981" },
];
