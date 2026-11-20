export const metadata = { title: "Users" };

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/guards";
import { getProfile } from "@/services/profiles.service";
import { listTeamMembers } from "@/services/users.service";
import { canManageUsers } from "@/types/role";
import { AppShell } from "@/components/layout/app-shell";
import { AdminsOnly } from "@/components/users/admins-only";
import { RoleLegend } from "@/components/users/role-legend";
import { UserManager } from "@/components/users/user-manager";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, viewer] = await Promise.all([getProfile(supabase, user.id), getViewer()]);
  // listTeamMembers uses the service-role key — never reach it unless the viewer is an admin.
  const admin = viewer && canManageUsers(viewer.role) ? viewer : null;
  const members = admin ? await listTeamMembers() : [];

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Users"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        {admin ? (
          <>
            <RoleLegend />
            <UserManager initialMembers={members} viewerId={admin.userId} />
          </>
        ) : (
          <AdminsOnly role={viewer?.role ?? null} />
        )}
      </main>
    </AppShell>
  );
}
