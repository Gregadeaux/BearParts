"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { SubsystemComment } from "@/services/subsystem-comments.service";
import { listSubsystemComments } from "@/services/subsystem-comments.service";
import {
  addSubsystemCommentAction,
  deleteSubsystemCommentAction,
} from "@/app/actions/subsystems";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { formatDateTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionComposer } from "@/components/comments/mention-composer";
import { CommentBody } from "@/components/comments/comment-body";

interface Props {
  subsystemId: string;
  subsystemName: string;
  team: { id: string; display_name: string }[];
  userId: string;
  initial: SubsystemComment[];
  className?: string;
}

/** Subsystem discussion panel — live chat with @user mentions. */
export function SubsystemComments({
  subsystemId,
  subsystemName,
  team,
  userId,
  initial,
  className,
}: Props) {
  const [comments, setComments] = useState(initial);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const refetch = () =>
    listSubsystemComments(createClient(), subsystemId).then(setComments).catch(console.error);

  useLiveTable({
    table: "subsystem_comments",
    filter: `subsystem_id=eq.${subsystemId}`,
    onChange: refetch,
  });

  useEffect(() => {
    if (mounted.current) endRef.current?.scrollIntoView({ block: "nearest" });
    mounted.current = true;
  }, [comments.length]);

  const post = (body: string) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const comment = await addSubsystemCommentAction(subsystemId, body, subsystemName);
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
        await deleteSubsystemCommentAction(id);
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
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {comments.length}
          </span>
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
                    {formatDateTime(comment.created_at)}
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
                <CommentBody body={comment.body} knownVersions={[]} />
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <MentionComposer
          team={team}
          versions={[]}
          onSubmit={post}
          pending={pending}
          placeholder="Comment — @ to mention a teammate"
        />
      </div>
    </div>
  );
}
