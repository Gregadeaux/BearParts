---
name: browser-testing
description: How to test BearParts in Chrome (dev server access, test logins, file uploads). Use when verifying UI changes in a real browser.
---

# Browser testing this app

- Dev server: `npm run dev`. The connected Chrome may not resolve `localhost` —
  use the tailnet URL `http://100.106.89.29:3000` (already in `allowedDevOrigins`).
- **Sign in without Google:** POST to `/api/dev-login` (dev-only route) with one of
  the seeded users from `scripts/create-test-users.mjs`:
  - `designer@test.bearparts.dev` / `bearparts-test-1` (Dana Designer)
  - `machinist@test.bearparts.dev` / `bearparts-test-2` (Mack Machinist)
- **DXF uploads:** sample files in `samples/`. After `file_upload` into the hidden
  input, React's onChange fires automatically once the page is hydrated — if
  nothing happens, hydration failed (see shadcn-base-ui skill, item 6).
- **Mobile checks:** window resize may be ignored by the managed Chrome; emulate
  with a same-origin iframe at 390px width instead.
- **Service worker / push:** require HTTPS or localhost — expect
  `swRegistered: false` over the LAN IP; that is not a bug. Verify PWA behavior in
  production or via localhost.
- `/inspect` is public (no login) and exercises the full parse→analyze→render
  pipeline client-side — fastest smoke test for viewer/analysis changes.
