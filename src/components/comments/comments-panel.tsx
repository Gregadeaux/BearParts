"use client";

import { useEffect, useRef } from "react";
import { MapPin, MessageSquare, X } from "lucide-react";
import type { CommentAnchor, PartComment } from "@/services/comments.service";
import { MentionComposer } from "./mention-composer";
import { CommentBody } from "./comment-body";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateTime, initials } from "@/lib/format";

interface Props {
  comments: PartComment[];
  pending: boolean;
  onPost: (body: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  userId: string;
  team: { id: string; display_name: string }[];
  versions: number[];
  onSelectVersion?: (version: number) => void;
  /** comment id → pin number for anchored comments on the visible version */
  pinNumbers?: Record<string, number>;
  selectedCommentId?: string | null;
  onFocusAnnotation?: (comment: PartComment) => void;
  /** anchor staged for the next posted comment */
  pendingAnchor?: CommentAnchor | null;
  onClearAnchor?: () => void;
  className?: string;
}

/** Discussion stream: mention composer, pins, live comments (state lives in useComments). */
export function CommentsPanel({
  comments,
  pending,
  onPost,
  onRemove,
  userId,
  team,
  versions,
  onSelectVersion,
  pinNumbers = {},
  selectedCommentId = null,
  onFocusAnnotation,
  pendingAnchor,
  onClearAnchor,
  className,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [comments.length]);

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
            <p className="flex flex-col items-center gap-1 py-8 text-xs text-muted-foreground">
              <MessageSquare className="size-5 opacity-50" />
              No comments yet. Start the discussion.
            </p>
          )}
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`group flex gap-2 rounded-md p-1 -m-1 ${
                comment.id === selectedCommentId ? "bg-amber-50 dark:bg-amber-950/40" : ""
              }`}
            >
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
                  <span className="truncate text-xs font-medium">
                    {comment.author?.display_name ?? "Unknown"}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(comment.created_at)}
                  </span>
                  {comment.author_id === userId && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() => onRemove(comment.id)}
                      className="ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {comment.anchor && (
                  <button
                    type="button"
                    onClick={() => onFocusAnnotation?.(comment)}
                    className="mb-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
                  >
                    <MapPin className="size-3 shrink-0" />
                    {pinNumbers[comment.id] ? `#${pinNumbers[comment.id]} · ` : ""}
                    {comment.anchor.label ?? "pinned"}
                  </button>
                )}
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

      <div className="space-y-1.5 border-t p-2">
        {pendingAnchor && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <MapPin className="size-3" />
              {pendingAnchor.label ?? "pinned"}
            </span>
            <span className="text-muted-foreground">will be attached to your comment</span>
            <button
              type="button"
              aria-label="Remove pin"
              onClick={onClearAnchor}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <MentionComposer team={team} versions={versions} onSubmit={onPost} pending={pending} />
      </div>
    </div>
  );
}
