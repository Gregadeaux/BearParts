---
name: shadcn-base-ui
description: Gotchas for this repo's shadcn components (Base UI, not Radix). Use whenever writing or editing UI components.
---

# shadcn on Base UI — repo gotchas

This project's `components/ui` came from shadcn's Base UI registry. APIs differ
from the older Radix-based examples all over the internet:

1. **No `asChild`.** Compose with the `render` prop, and pass
   `nativeButton={false}` when rendering a non-button element:
   `<Button nativeButton={false} render={<Link href="/x" />}>Label</Button>`
   (omitting `nativeButton` logs a console error and breaks semantics).
2. **`Select` needs `items`.** `<SelectValue />` renders the raw value unless the
   root gets `items={[{ value, label }]}`. Always pass it.
3. **`onValueChange` receives `string | null`** — handle the null (e.g.
   `(v) => setX(v ?? fallback)`), don't pass a state setter directly.
4. **DropdownMenuItem:** use `onClick`, not Radix's `onSelect`.
5. **`crypto.randomUUID` needs a secure context** — use `randomId()` from
   `src/lib/id.ts` so LAN-IP dev over http keeps working.
6. Dev over the tailnet requires the IP in `allowedDevOrigins`
   (`next.config.ts`) or hydration silently never runs (SSR HTML only, no
   event handlers, wrong fonts — that's the symptom).
