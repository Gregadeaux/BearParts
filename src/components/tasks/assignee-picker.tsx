"use client";

import type { ReactNode } from "react";
import type { Person } from "@/types/task";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** trigger contents (avatar stack, label, …) */
  children: ReactNode;
  className?: string;
}

/** Multi-select over teammates — used by both the toolbar filter and the dialog. */
export function AssigneePicker({ people, selected, onChange, children, className }: Props) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" nativeButton />}
        className={className}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Find teammate…" />
          <CommandList>
            <CommandEmpty>Nobody found.</CommandEmpty>
            {people.map((p) => (
              <CommandItem
                key={p.id}
                value={p.display_name}
                data-checked={selected.includes(p.id)}
                onSelect={() => toggle(p.id)}
              >
                <Avatar size="sm">
                  {p.avatar_url && (
                    <AvatarImage src={p.avatar_url} alt="" referrerPolicy="no-referrer" />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {initials(p.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{p.display_name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
