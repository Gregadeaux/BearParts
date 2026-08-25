import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ogMeta } from "@/lib/og";
import { getProfile } from "@/services/profiles.service";
import { listFolders, getAncestry } from "@/services/folders.service";
import { listLibraryParts } from "@/services/library.service";
import { listSubsystems } from "@/services/subsystems.service";
import { listFavoriteFolderIds } from "@/services/folder-favorites.service";
import { listProjects } from "@/services/tasks.service";
import { getFileUrl } from "@/services/storage.service";
import { AppShell } from "@/components/layout/app-shell";
import { LibraryBrowser } from "@/components/library/library-browser";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}): Promise<Metadata> {
  const { f } = await searchParams;
  if (!f) return ogMeta("Library", "The team's part library");
  try {
    const admin = createAdminClient();
    const [{ data: folder }, { count: parts }, { count: folders }] = await Promise.all([
      admin.from("folders").select("name").eq("id", f).maybeSingle(),
      admin.from("library_parts").select("id", { count: "exact", head: true }).eq("folder_id", f),
      admin.from("folders").select("id", { count: "exact", head: true }).eq("parent_id", f),
    ]);
    if (!folder) return ogMeta("Library", "The team's part library");
    return ogMeta(
      folder.name,
      `${parts ?? 0} part${parts === 1 ? "" : "s"} · ${folders ?? 0} folder${folders === 1 ? "" : "s"} · Part library`,
    );
  } catch {
    return ogMeta("Library", "The team's part library");
  }
}

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

  const [profile, subfolders, parts, ancestry, subsystems, projects, favoriteFolderIds] =
    await Promise.all([
      getProfile(supabase, user.id),
      listFolders(supabase, folderId ?? null),
      folderId ? listLibraryParts(supabase, folderId) : Promise.resolve([]),
      folderId ? getAncestry(supabase, folderId) : Promise.resolve([]),
      listSubsystems(supabase),
      listProjects(supabase),
      listFavoriteFolderIds(supabase, user.id),
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
          subsystems={subsystems}
          projects={projects}
          thumbUrls={thumbUrls}
          favoriteFolderIds={favoriteFolderIds}
        />
      </main>
    </AppShell>
  );
}
