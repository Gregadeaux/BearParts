"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { CommentAnchor, PartComment } from "@/services/comments.service";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { listComments } from "@/services/comments.service";
import { addCommentAction, deleteCommentAction } from "@/app/actions/comments";

/** Live comment state for a library part — realtime + optimistic post/delete. */
export function useComments(libraryPartId: string, partName: string, initial: PartComment[]) {
  const [comments, setComments] = useState(initial);
  const [pending, startTransition] = useTransition();

  useLiveTable({
    table: "part_comments",
    filter: `library_part_id=eq.${libraryPartId}`,
    onChange: () =>
      listComments(createClient(), libraryPartId).then(setComments).catch(console.error),
  });

  const post = (body: string, anchor?: CommentAnchor) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const comment = await addCommentAction(libraryPartId, body, partName, anchor);
          setComments((cs) => (cs.some((c) => c.id === comment.id) ? cs : [...cs, comment]));
          resolve(true);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not post comment");
          resolve(false);
        }
      });
    });

  const remove = (id: string) =>
    startTransition(async () => {
      try {
        await deleteCommentAction(id);
        setComments((cs) => cs.filter((c) => c.id !== id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete comment");
      }
    });

  return { comments, pending, post, remove };
}
