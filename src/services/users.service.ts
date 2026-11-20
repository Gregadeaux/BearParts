import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { asRole, ROLES, type Role } from "@/types/role";

/*
 * Team roster for the admin user-management page.
 *
 * SECURITY: uses the service-role client (bypasses RLS) because login emails
 * only live in auth.users. Callers MUST verify the viewer is an admin first
 * (requireAdmin() / getViewer() + canManageUsers()). This is a deliberate,
 * documented exception to the "services take an injected client" rule.
 */

export interface TeamMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  role: Role;
  createdAt: string;
}

const PER_PAGE = 1000;
const MAX_PAGES = 20; // safety stop; the team is a few dozen people

async function emailsById(admin: ReturnType<typeof createAdminClient>) {
  const emails = new Map<string, string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`Could not load team emails: ${error.message}`);
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
    if (data.users.length < PER_PAGE) break;
  }
  return emails;
}

const roleRank = (role: Role) => ROLES.findIndex((r) => r.value === role);

/** Everyone with a profile, admin -> lead -> student, then by name. */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const admin = createAdminClient();
  const [{ data: profiles, error }, emails] = await Promise.all([
    admin.from("profiles").select("id, display_name, avatar_url, role, created_at"),
    emailsById(admin),
  ]);
  if (error) throw new Error(`Could not load team: ${error.message}`);

  return profiles
    .map(
      (p): TeamMember => ({
        id: p.id,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        email: emails.get(p.id) ?? null,
        role: asRole(p.role),
        createdAt: p.created_at,
      }),
    )
    .sort(
      (a, b) =>
        roleRank(a.role) - roleRank(b.role) || a.displayName.localeCompare(b.displayName),
    );
}
