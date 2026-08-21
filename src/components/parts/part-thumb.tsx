"use client";

import { useEffect, useState } from "react";
import { Box, FileText, FileType2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl } from "@/services/storage.service";
import { cn } from "@/lib/utils";

// signed URLs are valid for an hour — share them across cards and rerenders
const urlCache = new Map<string, Promise<string>>();

function signedUrl(path: string): Promise<string> {
  let cached = urlCache.get(path);
  if (!cached) {
    cached = getFileUrl(createClient(), path);
    cached.catch(() => urlCache.delete(path));
    urlCache.set(path, cached);
  }
  return cached;
}

interface Props {
  path: string | null;
  fileType?: string;
  alt?: string;
  className?: string;
}

/** Small part preview square; falls back to a file-type icon. */
export function PartThumb({ path, fileType, alt = "", className }: Props) {
  const [urlFor, setUrlFor] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let stale = false;
    signedUrl(path)
      .then((url) => !stale && setUrlFor({ path, url }))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [path]);

  const url = path && urlFor?.path === path ? urlFor.url : null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : fileType === "stl" ? (
        <Box className="size-8 text-violet-500 opacity-40" />
      ) : fileType === "step" ? (
        <Box className="size-8 text-emerald-600 opacity-40" />
      ) : fileType === "pdf" ? (
        <FileType2 className="size-8 text-red-400 opacity-40" />
      ) : (
        <FileText className="size-8 text-sky-500 opacity-40" />
      )}
    </div>
  );
}
