---
name: architecture
description: Code architecture rules for BearParts — layering, file layout, and component conventions. Use when adding any feature, page, or service.
---

# BearParts architecture

Layering (SOLID — dependencies point downward only):

```
app/            thin pages & route handlers — compose components, call services
components/     presentational + small client containers (shadcn in components/ui)
services/       all business logic; supabase client injected as a parameter
lib/            supabase client factories, utilities
types/          shared types; no runtime logic
```

Rules:

1. **Pages stay thin.** A page fetches via a service and renders components.
   No business logic, no direct supabase queries in pages/components.
2. **Services take a `SupabaseClient` argument** (dependency injection) so the same
   service runs in server components, route handlers, and the browser. Never
   instantiate a client inside a service. (Documented exceptions, both
   `server-only`: `notifications.service.ts` push fan-out and `users.service.ts`,
   which needs the service role for auth emails — its callers must verify admin.)
3. **Server-only secrets** (service-role key, VAPID private key) are only read in
   `lib/supabase/admin.ts` and `services/notifications.service.ts` — files imported
   exclusively from server code (route handlers / server actions).
4. **Small files.** Split anything pushing ~200 lines. One component per file.
5. **shadcn for primitives** (`components/ui`) — never restyle raw HTML controls
   when a shadcn primitive exists. Domain components live in `components/<domain>/`.
6. **Mobile first.** Every screen must work one-handed on a phone; the machinist at
   the mill is the primary viewer persona. Test at 390px width.
7. **Keep copy terse.** Labels over paragraphs; the team is high-schoolers in a
   hurry, not enterprise users.
8. **Roles** (`admin` / `lead` / `student`, `src/types/role.ts`). Students create,
   edit, move, and complete anything but can't delete or archive; leads also delete
   and archive; admins also change roles (`/users`). Server guards live in
   `src/lib/supabase/guards.ts`: `requireUser` / `requireLead` / `requireAdmin` for
   actions, `getViewer()` for server components. **Every new destructive action must
   use `requireLead()` AND ship a lead-only delete policy**
   (`using (public.is_lead_or_admin())`). The UI hides destructive controls via
   `useCan` — hiding is UX; RLS is the real gate.
