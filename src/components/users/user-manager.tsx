"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import type { TeamMember } from "@/services/users.service";
import { ROLES, roleLabel, type Role } from "@/types/role";
import { setUserRoleAction, type SetUserRoleResult } from "@/app/actions/users";
import { Input } from "@/components/ui/input";
import { ConfirmOwnRoleDialog } from "./confirm-own-role-dialog";
import { UserRow } from "./user-row";
import { firstName, matchesQuery, withArticle, withRole } from "./user-utils";

interface Props {
  /** sorted admin → lead → student; rows keep their spot after a change */
  initialMembers: TeamMember[];
  viewerId: string;
}

type RoleChange = { id: string; role: Role };

/** Admin-only team list: filter by name, set roles. Changing your own role needs a confirm. */
export function UserManager({ initialMembers, viewerId }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [shown, showOptimistic] = useOptimistic(members, (list, change: RoleChange) =>
    withRole(list, change.id, change.role),
  );
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [ownTarget, setOwnTarget] = useState<Role | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const applyRole = (member: TeamMember, role: Role) =>
    startTransition(async () => {
      showOptimistic({ id: member.id, role });
      // On any failure, skip setMembers: the optimistic value drops when the transition ends.
      let result: SetUserRoleResult;
      try {
        result = await setUserRoleAction(member.id, role);
      } catch {
        // network / unexpected server crash (expected failures come back as { ok: false })
        result = { ok: false, error: "Could not change role" };
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      startTransition(() => setMembers((list) => withRole(list, member.id, role)));
      const self = member.id === viewerId;
      const who = self ? "You’re" : `${firstName(member.displayName)} is`;
      toast.success(`${who} now ${withArticle(roleLabel(role))}`);
      // You just stopped being an admin: re-render so the page and nav catch up.
      if (self) router.refresh();
    });

  const requestRole = (member: TeamMember, role: Role) => {
    if (member.id === viewerId) {
      setOwnTarget(role);
      setConfirmOpen(true);
    } else {
      applyRole(member, role);
    }
  };

  const confirmOwnRole = () => {
    const me = members.find((m) => m.id === viewerId);
    if (me && ownTarget) applyRole(me, ownTarget);
    setConfirmOpen(false);
  };

  const savedRole = new Map(members.map((m) => [m.id, m.role]));
  const visible = shown.filter((m) => matchesQuery(m, query));
  const counts = ROLES.map((r) => {
    const n = shown.filter((m) => m.role === r.value).length;
    return `${n} ${r.label.toLowerCase()}${n === 1 ? "" : "s"}`;
  }).join(" · ");

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name…"
            aria-label="Filter by name or email"
            className="pl-8"
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{counts}</span>
      </div>

      <div className="divide-y rounded-lg border">
        {visible.map((member) => (
          <UserRow
            key={member.id}
            member={member}
            isViewer={member.id === viewerId}
            saving={member.role !== savedRole.get(member.id)}
            onRoleChange={(role) => requestRole(member, role)}
          />
        ))}
        {visible.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            {query.trim() ? "No matches." : "No one here yet."}
          </p>
        )}
      </div>

      <ConfirmOwnRoleDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        role={ownTarget}
        onConfirm={confirmOwnRole}
      />
    </div>
  );
}
