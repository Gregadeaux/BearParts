import Link from "next/link";
import { History } from "lucide-react";
import type { SubsystemUpload } from "@/services/subsystems.service";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateTime, initials } from "@/lib/format";

interface Props {
  uploads: SubsystemUpload[];
  className?: string;
}

/** Upload history feed, newest first — same panel chrome as Discussion. */
export function HistoryPanel({ uploads, className }: Props) {
  return (
    <div className={`flex min-h-0 flex-col rounded-lg border ${className ?? ""}`}>
      <div className="border-b px-3 py-2 text-sm font-medium">
        History
        {uploads.length > 0 && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{uploads.length}</span>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {uploads.length === 0 && (
            <p className="flex flex-col items-center gap-1 py-8 text-xs text-muted-foreground">
              <History className="size-5 opacity-50" />
              No uploads yet.
            </p>
          )}
          {uploads.map((upload) => (
            <Link
              key={upload.id}
              href={upload.library_part ? `/library/parts/${upload.library_part.id}` : "#"}
              className="flex items-start gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/60"
            >
              <Avatar className="mt-0.5 size-6 shrink-0">
                {upload.uploader?.avatar_url && (
                  <AvatarImage src={upload.uploader.avatar_url} referrerPolicy="no-referrer" />
                )}
                <AvatarFallback className="text-[9px]">
                  {initials(upload.uploader?.display_name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {upload.library_part?.name ?? "Deleted part"}{" "}
                  <span className="text-muted-foreground">v{upload.version}</span>
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {upload.uploader?.display_name ?? "Unknown"} · {formatDateTime(upload.created_at)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
