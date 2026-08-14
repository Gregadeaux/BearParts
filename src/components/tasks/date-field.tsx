"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDay, toDate, toISODate } from "./task-utils";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

/** Clearable day picker. Values are plain `yyyy-MM-dd` strings — no timezone math. */
export function DateField({ value, onChange, placeholder = "Pick a day" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" nativeButton />}
          className="min-w-0 flex-1 justify-start font-normal"
        >
          <CalendarDays />
          {value ? formatDay(value) : <span className="text-muted-foreground">{placeholder}</span>}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={toDate(value)}
            defaultMonth={toDate(value)}
            onSelect={(day) => {
              onChange(toISODate(day));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon-sm" aria-label="Clear" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
