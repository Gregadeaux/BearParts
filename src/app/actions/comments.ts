"use server";

import { createClient } from "@/lib/supabase/server";
import * as comments from "@/services/comments.service";
import type { CommentAnchor } from "@/services/comments.service";
import { notifyUsers } from "@/services/notify.service";
import { commentPreview, mentionedUserIds } from "@/lib/mentions";

export async function addCommentAction(
  libraryPartId: string,
  body: string,
  partName: string,
  anchor?: CommentAnchor,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const comment = await comments.createComment(supabase, user.id, libraryPartId, body, anchor);

  await notifyUsers(supabase, mentionedUserIds(body), {
    kind: "mention",
    title: `Mentioned on ${partName}`,
    body: `${comment.author?.display_name ?? "Someone"}: ${commentPreview(body)}`,
    url: `/library/parts/${libraryPartId}`,
    actorId: user.id,
  });
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
