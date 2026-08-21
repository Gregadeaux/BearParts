import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPart } from "@/services/parts.service";
import { getFileUrl } from "@/services/storage.service";
import { listVersionDocuments } from "@/services/version-documents.service";
import { getAncestry } from "@/services/folders.service";
import { listSubsystems } from "@/services/subsystems.service";
import type { Crumb } from "@/components/layout/page-breadcrumb";
import { listProfiles, getProfile } from "@/services/profiles.service";
import { AppShell } from "@/components/layout/app-shell";
import { PartDetail } from "@/components/parts/part-detail";
import { NewPartButton } from "@/components/parts/new-part-button";

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [part, team, profile] = await Promise.all([
    getPart(supabase, id),
    listProfiles(supabase),
    getProfile(supabase, user.id),
  ]);
  if (!part) notFound();

  const [fileUrl, documents] = await Promise.all([
    getFileUrl(supabase, part.file_path),
    // library-sourced parts surface their version's drawings + G-code
    listVersionDocuments(supabase, part.source_version_id ? [part.source_version_id] : []),
  ]);
  const versionDocs = part.source_version_id ? (documents[part.source_version_id] ?? []) : [];

  // breadcrumbs: library-sourced parts trace back through their library home
  const libraryPart = part.source_version?.library_part ?? null;
  let crumbs: Crumb[] = [{ label: "Board", href: "/board" }, { label: part.name }];
  if (libraryPart) {
    const { data: libRow } = await supabase
      .from("library_parts")
      .select("folder_id")
      .eq("id", libraryPart.id)
      .maybeSingle();
    if (libRow) {
      const [ancestry, subsystems] = await Promise.all([
        getAncestry(supabase, libRow.folder_id),
        listSubsystems(supabase),
      ]);
      const byFolder = Object.fromEntries(subsystems.map((s) => [s.folder_id, s.id]));
      crumbs = [
        { label: "Library", href: "/library" },
        ...ancestry.map((f) => ({
          label: f.name,
          href: byFolder[f.id] ? `/subsystems/${byFolder[f.id]}` : `/library?f=${f.id}`,
        })),
        { label: libraryPart.name, href: `/library/parts/${libraryPart.id}` },
        { label: part.name },
      ];
    }
  }

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title={part.name}
      action={<NewPartButton />}
    >
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <PartDetail
          part={part}
          team={team}
          userId={user.id}
          fileUrl={fileUrl}
          versionDocs={versionDocs}
          crumbs={crumbs}
        />
      </main>
    </AppShell>
  );
}
