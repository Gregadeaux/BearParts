# 🐻 BearParts

Part queue for an FRC machine shop. Designers drop DXFs in, machinists pull them up
on their phones at the mill.

**What it does**

- Upload a DXF → instant viewer + machining analysis (hole sizes, tap/clearance/bearing
  matches, max endmill for pockets, sharp-corner warnings, unit detection)
- Queue parts or assign them to a teammate; claim, start, finish from any device
- Live queue via Supabase Realtime; push notifications (new part, assigned to you, done)
- Installable PWA — works on Chrome and iOS home screen
- `/inspect` — public, login-free DXF checker that never uploads anything

## Stack

Next.js (App Router) · Supabase (Postgres, Auth, Storage, Realtime) · shadcn/ui ·
custom SVG DXF viewer · web-push. Architecture notes live in `.claude/skills/`.

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev
```

- Supabase project: **BearParts** (`lrufhxysqcrmthqzyqwq`). Schema changes go in
  `supabase/migrations/` and apply with `npx supabase db push`.
- Tests: `npx vitest run` (DXF analysis engine).
- Sample parts to play with: `samples/*.dxf` (regenerate via `node scripts/generate-samples.mjs`).
- Dev sign-in without Google: `node scripts/create-test-users.mjs`, then POST
  `{email, password}` to `/api/dev-login` (disabled in production).

## One-time setup still needed

**Google OAuth** (the only manual step):

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → create
   OAuth client (Web application).
2. Authorized redirect URI: `https://lrufhxysqcrmthqzyqwq.supabase.co/auth/v1/callback`
3. [Supabase Dashboard → Auth → Providers → Google](https://supabase.com/dashboard/project/lrufhxysqcrmthqzyqwq/auth/providers)
   → enable, paste client ID + secret.
4. Supabase Dashboard → Auth → URL Configuration → add your prod URL
   (e.g. `https://bearparts.fly.dev`) to Redirect URLs.

## Deploy (Fly.io)

`fly.toml` + `Dockerfile` are ready. Using the
[Fly GitHub app](https://fly.io/docs/launch/continuous-deployment-with-github-actions/):
connect the repo, then set server secrets once:

```bash
fly secrets set SUPABASE_SERVICE_ROLE_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
```

Public keys (Supabase URL/anon, VAPID public) are baked in as build args in `fly.toml`.

## Hole standards

Classification table (`src/services/dxf/machining-standards.ts`): 10-32 tap/close/free,
1/4-20 tap/close/free, 1.125" + 0.875" bearing bores, 1/2" + 3/8" shaft clearance.
Match tolerance ±0.005". Add rows there to teach it new hardware.
