"use client";

import { toast } from "sonner";
import { Download } from "lucide-react";
import type { PartVersion } from "@/types/library";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl } from "@/services/storage.service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, initials } from "@/lib/format";

interface Props {
  versions: PartVersion[];
  partName: string;
  selectedId: string;
  onSelect: (version: PartVersion) => void;
}

/** Version list, latest on top. Click a row to load it in the viewer. */
export function VersionHistory({ versions, partName, selectedId, onSelect }: Props) {
  const download = async (v: PartVersion) => {
    try {
      const url = await getFileUrl(createClient(), v.file_path);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${partName}-v${v.version}.${v.file_type}`;
      a.click();
    } catch {
      toast.error("Could not download file");
    }
  };

  return (
    <div className="divide-y rounded-lg border">
      {versions.map((v) => {
        const selected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
              selected ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <Badge variant={selected ? "default" : "secondary"} className="tabular-nums">
              v{v.version}
            </Badge>
            <span className="text-xs uppercase text-muted-foreground">{v.file_type}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {v.note ?? ""}
            </span>
            {v.uploader && (
              <Avatar className="size-5" title={v.uploader.display_name}>
                {v.uploader.avatar_url && (
                  <AvatarImage src={v.uploader.avatar_url} referrerPolicy="no-referrer" />
                )}
                <AvatarFallback className="text-[9px]">
                  {initials(v.uploader.display_name)}
                </AvatarFallback>
              </Avatar>
            )}
            <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download v${v.version}`}
              nativeButton={false}
              render={<span role="button" tabIndex={0} />}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                download(v);
              }}
            >
              <Download />
            </Button>
          </button>
        );
      })}
    </div>
  );
}
