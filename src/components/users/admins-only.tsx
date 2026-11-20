import { ShieldCheck } from "lucide-react";
import { roleLabel, type Role } from "@/types/role";
import { withArticle } from "./user-utils";

/** /users empty state for anyone who isn't an admin. */
export function AdminsOnly({ role }: { role: Role | null }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-10 text-center">
      <ShieldCheck className="mb-1 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">Admins only</p>
      <p className="text-xs text-muted-foreground">
        {role ? `You’re ${withArticle(roleLabel(role))}. ` : ""}Ask an admin to change roles.
      </p>
    </div>
  );
}
