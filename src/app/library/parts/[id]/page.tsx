import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { getLibraryPart } from "@/services/library.service";
import { listComments } from "@/services/comments.service";
import { listPartEvents } from "@/services/events.service";
import { getAncestry } from "@/services/folders.service";
import { AppShell } from "@/components/layout/app-shell";
import { LibraryPartView } from "@/components/library/library-part-view";

export default async function LibraryPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const part = await getLibraryPart(supabase, id);
  if (!part) notFound();

  const [profile, team, ancestry, comments, events] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    getAncestry(supabase, part.folder_id),
    listComments(supabase, part.id),
    listPartEvents(supabase, part.id),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title={part.name}
    >
      <main className="space-y-4 p-4">
        <LibraryPartView
          part={part}
          ancestry={ancestry}
          team={team}
          userId={user.id}
          initialComments={comments}
          events={events}
        />
      </main>
    </AppShell>
  );
}
