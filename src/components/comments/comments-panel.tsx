"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { PartComment } from "@/services/comments.service";
import { createClient } from "@/lib/supabase/client";
import { listComments } from "@/services/comments.service";
import { addCommentAction, deleteCommentAction } from "@/app/actions/comments";
import { MentionComposer } from "./mention-composer";
import { CommentBody } from "./comment-body";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, initials } from "@/lib/format";

interface Props {
  libraryPartId: string;
  partName: string;
  userId: string;
  team: { id: string; display_name: string }[];
  versions: number[];
  initialComments: PartComment[];
  onSelectVersion?: (version: number) => void;
  className?: string;
}

/** Live discussion stream: realtime comments + mention composer. */
export function CommentsPanel({
  libraryPartId,
  partName,
  userId,
  team,
  versions,
  initialComments,
  onSelectVersion,
  className,
}: Props) {
  const [comments, setComments] = useState(initialComments);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments-${libraryPartId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "part_comments",
          filter: `library_part_id=eq.${libraryPartId}`,
        },
        () => {
          listComments(supabase, libraryPartId).then(setComments).catch(console.error);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [libraryPartId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [comments.length]);

  const post = (body: string) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const comment = await addCommentAction(libraryPartId, body, partName);
          setComments((cs) => (cs.some((c) => c.id === comment.id) ? cs : [...cs, comment]));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not post comment");
        }
        resolve();
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

  return (
    <div className={`flex min-h-0 flex-col rounded-lg border ${className ?? ""}`}>
      <div className="border-b px-3 py-2 text-sm font-medium">
        Discussion
        {comments.length > 0 && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{comments.length}</span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {comments.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No comments yet. Start the discussion.
            </p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="group flex gap-2">
              <Avatar className="mt-0.5 size-6 shrink-0">
                {comment.author?.avatar_url && (
                  <AvatarImage src={comment.author.avatar_url} referrerPolicy="no-referrer" />
                )}
                <AvatarFallback className="text-[9px]">
                  {initials(comment.author?.display_name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">
                    {comment.author?.display_name ?? "Unknown"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(comment.created_at)}
                  </span>
                  {comment.author_id === userId && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() => remove(comment.id)}
                      className="ml-auto hidden text-muted-foreground hover:text-destructive group-hover:block"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <CommentBody
                  body={comment.body}
                  knownVersions={versions}
                  onSelectVersion={onSelectVersion}
                />
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <MentionComposer team={team} versions={versions} onSubmit={post} pending={pending} />
      </div>
    </div>
  );
}
