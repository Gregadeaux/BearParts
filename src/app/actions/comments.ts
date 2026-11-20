"use server";

import { requireUser } from "@/lib/supabase/guards";
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
  const { supabase, user } = await requireUser();
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

/** Author or lead/admin — RLS decides, so any signed-in user may try. */
export async function deleteCommentAction(commentId: string) {
  const { supabase } = await requireUser();
  await comments.deleteComment(supabase, commentId);
}
