import { ROLES, type Role } from "@/types/role";
import { cn } from "@/lib/utils";

/** What each role adds on top of the one below it. */
const ROLE_CAN: Record<Role, string> = {
  student: "add & edit",
  lead: "+ delete & archive",
  admin: "+ manage users",
};

/** One-line cheat sheet, lowest role first. Wraps between entries on phones. */
export function RoleLegend({ className }: { className?: string }) {
  const lowestFirst = [...ROLES].reverse();
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {lowestFirst.map((r, i) => (
        <span key={r.value}>
          {i > 0 && " · "}
          <span className="whitespace-nowrap">
            <span className="font-medium text-foreground">{r.label}</span>: {ROLE_CAN[r.value]}
          </span>
        </span>
      ))}
    </p>
  );
}
