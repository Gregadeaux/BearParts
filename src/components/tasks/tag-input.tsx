"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandItem, CommandList } from "@/components/ui/command";

const MAX_TAGS = 8;

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** every tag already in use, for suggestions */
  suggestions: string[];
}

/** Removable tag chips + a creatable, suggestion-backed input. Max 8, lowercased. */
export function TagInput({ tags, onChange, suggestions }: Props) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const full = tags.length >= MAX_TAGS;

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    setDraft("");
    setOpen(false);
    if (!tag || full || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  const query = draft.trim().toLowerCase();
  const matches = suggestions
    .filter((s) => !tags.includes(s) && (!query || s.includes(query)))
    .slice(0, 6);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && draft.trim())) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-input p-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}

      <input
        value={draft}
        disabled={full}
        aria-label="Add tag"
        placeholder={full ? "Tag limit reached" : tags.length ? "" : "Add tags…"}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          if (draft.trim()) add(draft);
        }}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />

      {open && matches.length > 0 && (
        // opens upward: the dialog body scrolls, so a downward list would clip
        <div className="absolute bottom-full left-0 z-50 mb-1 w-52 overflow-hidden rounded-lg bg-popover shadow-md ring-1 ring-foreground/10">
          <Command shouldFilter={false}>
            <CommandList>
              {matches.map((s) => (
                <CommandItem
                  key={s}
                  value={s}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => add(s)}
                >
                  {s}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
