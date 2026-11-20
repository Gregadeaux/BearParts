"use client";

import type { TeamMember } from "@/services/users.service";
import type { Role } from "@/types/role";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RoleSelect } from "./role-select";

interface Props {
  member: TeamMember;
  /** the signed-in admin's own row */
  isViewer: boolean;
  /** a role change for this row is in flight */
  saving: boolean;
  onRoleChange: (role: Role) => void;
}

/** Avatar · name/email · role picker. Fits one line at 390px. */
export function UserRow({ member, isViewer, saving, onRoleChange }: Props) {
  const name = member.displayName || "Unnamed";
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Avatar className="size-9">
        {member.avatarUrl && (
          <AvatarImage src={member.avatarUrl} alt={name} referrerPolicy="no-referrer" />
        )}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          {isViewer && <Badge variant="secondary">You</Badge>}
        </div>
        {member.email && (
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        )}
      </div>
      <RoleSelect
        value={member.role}
        label={`Role for ${name}`}
        disabled={saving}
        onChange={onRoleChange}
        className="shrink-0"
      />
    </div>
  );
}
