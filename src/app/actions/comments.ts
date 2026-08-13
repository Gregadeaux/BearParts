"use server";

import { createClient } from "@/lib/supabase/server";
import * as comments from "@/services/comments.service";
import { sendPush } from "@/services/notifications.service";
import { commentPreview, mentionedUserIds } from "@/lib/mentions";

export async function addCommentAction(libraryPartId: string, body: string, partName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const comment = await comments.createComment(supabase, user.id, libraryPartId, body);

  const mentioned = mentionedUserIds(body).filter((id) => id !== user.id);
  if (mentioned.length > 0) {
    await sendPush(mentioned, {
      title: `Mentioned on ${partName}`,
      body: `${comment.author?.display_name ?? "Someone"}: ${commentPreview(body)}`,
      url: `/library/parts/${libraryPartId}`,
    });
  }
  return comment;
}

export async function deleteCommentAction(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await comments.deleteComment(supabase, commentId);
}
