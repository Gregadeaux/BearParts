import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { listFolders, getAncestry } from "@/services/folders.service";
import { listLibraryParts } from "@/services/library.service";
import { getFileUrl } from "@/services/storage.service";
import { AppShell } from "@/components/layout/app-shell";
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

  // signed URLs for the latest-version previews
  const thumbEntries = await Promise.all(
    parts
      .filter((p) => p.latest?.thumb_path)
      .map(async (p) => {
        try {
          return [p.id, await getFileUrl(supabase, p.latest!.thumb_path!)] as const;
        } catch {
          return null;
        }
      }),
  );
  const thumbUrls = Object.fromEntries(thumbEntries.filter((e): e is [string, string] => e !== null));

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Library"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <LibraryBrowser
          currentFolderId={folderId ?? null}
          ancestry={ancestry}
          folders={subfolders}
          parts={parts}
          thumbUrls={thumbUrls}
        />
      </main>
    </AppShell>
  );
}
