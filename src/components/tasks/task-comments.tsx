"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { TaskComment } from "@/services/task-comments.service";
import { listTaskComments } from "@/services/task-comments.service";
import { addTaskCommentAction, deleteTaskCommentAction } from "@/app/actions/tasks";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { formatDateTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionComposer } from "@/components/comments/mention-composer";
import { CommentBody } from "@/components/comments/comment-body";

interface Props {
  taskId: string;
  taskTitle: string;
  team: { id: string; display_name: string }[];
  userId: string;
  /** panel: full-height column with its own scroll (desktop); inline: grows in place (mobile) */
  layout?: "inline" | "panel";
}

/** Chat-style discussion for a task — live, with @user mentions. */
export function TaskComments({ taskId, taskTitle, team, userId, layout = "inline" }: Props) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const loadedOnce = useRef(false);

  const refetch = () =>
    listTaskComments(createClient(), taskId).then(setComments).catch(console.error);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useLiveTable({
    table: "task_comments",
    filter: `task_id=eq.${taskId}`,
    onChange: refetch,
  });

  // jump to the newest comment, but not on the initial render
  useEffect(() => {
    if (loadedOnce.current) endRef.current?.scrollIntoView({ block: "nearest" });
    if (comments.length > 0) loadedOnce.current = true;
  }, [comments.length]);

  const post = (body: string) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const comment = await addTaskCommentAction(taskId, body, taskTitle);
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
        await deleteTaskCommentAction(id);
        setComments((cs) => cs.filter((c) => c.id !== id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete comment");
      }
    });

  const list = (
    <>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} userId={userId} onRemove={remove} />
      ))}
      <div ref={endRef} />
    </>
  );

  const composer = (
    <MentionComposer
      team={team}
      versions={[]}
      onSubmit={post}
      pending={pending}
      placeholder="Comment — @ to mention a teammate"
    />
  );

  if (layout === "panel") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-3 py-2 text-sm font-medium">
          Comments
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
            {list}
          </div>
        </ScrollArea>
        <div className="border-t p-2">{composer}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">
        Comments
        {comments.length > 0 && <span className="ml-1.5 tabular-nums">{comments.length}</span>}
      </span>
      {comments.length > 0 && <div className="space-y-3">{list}</div>}
      {composer}
    </div>
  );
}

function CommentItem({
  comment,
  userId,
  onRemove,
}: {
  comment: TaskComment;
  userId: string;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group flex gap-2">
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
          <span className="text-xs font-medium">{comment.author?.display_name ?? "Unknown"}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatDateTime(comment.created_at)}
          </span>
          {comment.author_id === userId && (
            <button
              type="button"
              aria-label="Delete comment"
              onClick={() => onRemove(comment.id)}
              className="ml-auto hidden text-muted-foreground hover:text-destructive group-hover:block"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <CommentBody body={comment.body} knownVersions={[]} />
      </div>
    </div>
  );
}
