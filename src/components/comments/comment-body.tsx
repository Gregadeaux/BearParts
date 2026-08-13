"use client";

import { parseComment } from "@/lib/mentions";

interface Props {
  body: string;
  /** versions that actually exist — real ones render as clickable chips */
  knownVersions: number[];
  onSelectVersion?: (version: number) => void;
}

/** Comment text with user/version mentions rendered as chips. */
export function CommentBody({ body, knownVersions, onSelectVersion }: Props) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {parseComment(body).map((segment, i) => {
        if (segment.kind === "text") return <span key={i}>{segment.text}</span>;
        if (segment.kind === "user") {
          return (
            <span
              key={i}
              className="rounded bg-sky-100 px-1 font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
            >
              @{segment.name}
            </span>
          );
        }
        const exists = knownVersions.includes(segment.version);
        return exists && onSelectVersion ? (
          <button
            key={i}
            type="button"
            onClick={() => onSelectVersion(segment.version)}
            className="rounded bg-amber-100 px-1 font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
            title={`View v${segment.version}`}
          >
            @v{segment.version}
          </button>
        ) : (
          <span key={i} className="font-medium text-muted-foreground">
            @v{segment.version}
          </span>
        );
      })}
    </p>
  );
}
