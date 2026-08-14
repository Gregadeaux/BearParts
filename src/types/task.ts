import type { Database } from "./database";
import type { ProfileRow } from "./part";

export type SubgroupRow = Database["public"]["Tables"]["subgroups"]["Row"];
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type Person = Pick<ProfileRow, "id" | "display_name" | "avatar_url">;

/** Task with everything the UI needs joined in. */
export interface Task extends Omit<TaskRow, "status"> {
  status: TaskStatus;
  subgroup: SubgroupRow | null;
  project: ProjectRow | null;
  assignees: Person[];
  tags: string[];
}

/** Fixed status set (see research spec) — subgroup owns hue, status stays a neutral dot. */
export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo", label: "Not started", color: "#94a3b8" },
  { value: "in_progress", label: "In progress", color: "#3b82f6" },
  { value: "blocked", label: "Blocked", color: "#ef4444" },
  { value: "done", label: "Done", color: "#10b981" },
];
