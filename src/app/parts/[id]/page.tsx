import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPart } from "@/services/parts.service";
import { getFileUrl } from "@/services/storage.service";
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

  const fileUrl = await getFileUrl(supabase, part.file_path);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title={part.name}
      action={<NewPartButton />}
    >
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <PartDetail part={part} team={team} userId={user.id} fileUrl={fileUrl} />
      </main>
    </AppShell>
  );
}
