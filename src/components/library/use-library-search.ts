"use client";

import { useEffect, useState } from "react";
import type { LibrarySearchResult } from "@/services/library.service";
import { createClient } from "@/lib/supabase/client";
import { searchLibrary } from "@/services/library.service";
import { getFileUrl } from "@/services/storage.service";

/** Debounced whole-library search with signed thumbnail URLs. */
export function useLibrarySearch(query: string) {
  const [results, setResults] = useState<LibrarySearchResult | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const found = await searchLibrary(supabase, trimmed);
        setResults(found);
        const entries = await Promise.all(
          found.parts
            .filter((p) => p.latest?.thumb_path)
            .map(async (p) => {
              try {
                return [p.id, await getFileUrl(supabase, p.latest!.thumb_path!)] as const;
              } catch {
                return null;
              }
            }),
        );
        setThumbUrls(Object.fromEntries(entries.filter((e): e is [string, string] => e !== null)));
      } catch {
        setResults({ parts: [], folders: [] });
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, thumbUrls, searching };
}
