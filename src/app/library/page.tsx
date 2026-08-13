import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { listFolders, getAncestry } from "@/services/folders.service";
import { listLibraryParts } from "@/services/library.service";
import { AppHeader } from "@/components/layout/app-header";
import { LibraryBrowser } from "@/components/library/library-browser";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f: folderId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, subfolders, parts, ancestry] = await Promise.all([
    getProfile(supabase, user.id),
    listFolders(supabase, folderId ?? null),
    folderId ? listLibraryParts(supabase, folderId) : Promise.resolve([]),
    folderId ? getAncestry(supabase, folderId) : Promise.resolve([]),
  ]);

  return (
    <>
      <AppHeader
        userName={profile?.display_name ?? "Teammate"}
        userAvatar={profile?.avatar_url ?? null}
      />
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <LibraryBrowser
          currentFolderId={folderId ?? null}
          ancestry={ancestry}
          folders={subfolders}
          parts={parts}
        />
      </main>
    </>
  );
}
