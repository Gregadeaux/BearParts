"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setFavorite } from "@/services/folder-favorites.service";

export async function setFolderFavoriteAction(folderId: string, favorite: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await setFavorite(supabase, user.id, folderId, favorite);
  revalidatePath("/");
  revalidatePath("/library");
}
