import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ogMeta } from "@/lib/og";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { getLibraryPart } from "@/services/library.service";
import { listComments } from "@/services/comments.service";
import { listPartEvents } from "@/services/events.service";
import { getAncestry } from "@/services/folders.service";
import { listSubsystems } from "@/services/subsystems.service";
import { listVersionDocuments } from "@/services/version-documents.service";
import { AppShell } from "@/components/layout/app-shell";
import { LibraryPartView } from "@/components/library/library-part-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const admin = createAdminClient();
    const [{ data: part }, { data: versions }] = await Promise.all([
      admin
        .from("library_parts")
        .select("name, folders (name)")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("part_versions")
        .select("version, file_type, thumb_path")
        .eq("library_part_id", id)
        .order("version", { ascending: false })
        .limit(1),
    ]);
    if (!part) return ogMeta("Library part", "Part library");
    const latest = versions?.[0];
    const folder = (part.folders as unknown as { name: string } | null)?.name;
    const bits = [
      latest ? `v${latest.version} ${latest.file_type.toUpperCase()}` : null,
      folder,
      "Part library",
    ].filter(Boolean);
    return ogMeta(
      part.name,
      bits.join(" · "),
      latest?.thumb_path ? `/api/og/library-part/${id}` : null,
    );
  } catch {
    return ogMeta("Library part", "Part library");
  }
}

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

  const [profile, team, ancestry, comments, events, documents, subsystems] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    getAncestry(supabase, part.folder_id),
    listComments(supabase, part.id),
    listPartEvents(supabase, part.id),
    listVersionDocuments(supabase, part.versions.map((v) => v.id)),
    listSubsystems(supabase),
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
          documents={documents}
          subsystemsByFolder={Object.fromEntries(subsystems.map((s) => [s.folder_id, s.id]))}
        />
      </main>
    </AppShell>
  );
}
