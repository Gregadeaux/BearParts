"use client";

import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface Props {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

/** Toolbar tag filter (multi-select over every tag in use). */
export function TagFilter({ tags, selected, onChange }: Props) {
  const toggle = (tag: string) =>
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" nativeButton />}>
        <Tag />
        {selected.length ? `${selected.length} tags` : "Tags"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-0">
        <Command>
          <CommandInput placeholder="Find tag…" />
          <CommandList>
            <CommandEmpty>No tags yet.</CommandEmpty>
            {tags.map((tag) => (
              <CommandItem
                key={tag}
                value={tag}
                data-checked={selected.includes(tag)}
                onSelect={() => toggle(tag)}
              >
                <span className="truncate">{tag}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
