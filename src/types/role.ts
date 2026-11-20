/**
 * Team roles. Enforced in the database (0027_roles.sql: RLS + triggers) and
 * mirrored by the server guards in src/lib/supabase/guards.ts.
 *
 * - student: create / edit / move / complete anything; no deletes or archiving
 * - lead:    everything a student can do + delete + archive
 * - admin:   everything, including changing roles
 */
export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "lead", label: "Lead" },
  { value: "student", label: "Student" },
] as const;

export type Role = (typeof ROLES)[number]["value"];

export function isRole(value: unknown): value is Role {
  return ROLES.some((r) => r.value === value);
}

/** Normalize a raw profiles.role value; unknown / legacy ("member") -> student. */
export function asRole(value: string | null | undefined): Role {
  return isRole(value) ? value : "student";
}

/** Delete / archive anything. */
export function canDestroy(role: Role | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

/** Change other people's roles. */
export function canManageUsers(role: Role | null | undefined): boolean {
  return role === "admin";
}

export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.value === role)?.label ?? "Student";
}
