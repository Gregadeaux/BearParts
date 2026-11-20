import type { TeamMember } from "@/services/users.service";
import type { Role } from "@/types/role";

/** "Lead" → "a Lead", "Admin" → "an Admin" */
export function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

/** "Ryan Smith" → "Ryan" (falls back to the whole string). */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName || "Teammate";
}

/** Copy of `members` with one person's role swapped. */
export function withRole(members: TeamMember[], id: string, role: Role): TeamMember[] {
  return members.map((m) => (m.id === id ? { ...m, role } : m));
}

/** Case-insensitive match on name or email. */
export function matchesQuery(member: TeamMember, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    member.displayName.toLowerCase().includes(q) ||
    (member.email?.toLowerCase().includes(q) ?? false)
  );
}
