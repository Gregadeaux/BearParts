"use client";

import { ROLES, type Role } from "@/types/role";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: Role;
  /** fires only when the pick differs from `value` */
  onChange: (role: Role) => void;
  /** accessible name, e.g. "Role for Ryan" */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Admin / Lead / Student picker. Controlled — the parent owns the value. */
export function RoleSelect({ value, onChange, label, disabled, className }: Props) {
  return (
    <Select
      items={ROLES}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next && next !== value) onChange(next);
      }}
    >
      <SelectTrigger aria-label={label} className={cn("w-28", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
