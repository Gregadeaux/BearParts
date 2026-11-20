"use client";

import { createContext, useContext, useMemo } from "react";
import { canDestroy, canManageUsers, type Role } from "@/types/role";

/** null when signed out (or outside the provider) — every permission reads false. */
const RoleContext = createContext<Role | null>(null);

/**
 * Exposes the viewer's role to client components so they can hide controls the
 * server would refuse. UI-only — server actions + RLS are the real gate.
 */
export function RoleProvider({ role, children }: { role: Role | null; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role | null {
  return useContext(RoleContext);
}

export function useCan(): { destroy: boolean; manageUsers: boolean } {
  const role = useRole();
  return useMemo(
    () => ({ destroy: canDestroy(role), manageUsers: canManageUsers(role) }),
    [role],
  );
}
