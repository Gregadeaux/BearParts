"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/guards";
import { setFavorite } from "@/services/folder-favorites.service";

export async function setFolderFavoriteAction(folderId: string, favorite: boolean) {
  const { supabase, user } = await requireUser();
  await setFavorite(supabase, user.id, folderId, favorite);
  revalidatePath("/");
  revalidatePath("/library");
}
