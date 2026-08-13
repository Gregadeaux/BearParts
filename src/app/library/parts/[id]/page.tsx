import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { getLibraryPart } from "@/services/library.service";
import { listComments } from "@/services/comments.service";
import { getAncestry } from "@/services/folders.service";
import { AppHeader } from "@/components/layout/app-header";
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

  const [profile, team, ancestry, comments] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    getAncestry(supabase, part.folder_id),
    listComments(supabase, part.id),
  ]);

  return (
    <>
      <AppHeader
        userName={profile?.display_name ?? "Teammate"}
        userAvatar={profile?.avatar_url ?? null}
      />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <LibraryPartView
          part={part}
          ancestry={ancestry}
          team={team}
          userId={user.id}
          initialComments={comments}
        />
      </main>
    </>
  );
}
