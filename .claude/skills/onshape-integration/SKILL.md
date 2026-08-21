---
name: onshape-integration
description: Architecture and invariants of the Onshape right-panel integration (OAuth, iframe auth bridge, API caching, DXF/STEP export). Use when touching src/services/onshape, src/components/onshape, or /api/onshape routes.
---

# Onshape integration conventions

BearParts ships an Onshape "element right panel" extension: `/onshape/panel`
loads in an iframe inside cad.onshape.com, exports a DXF of a selected planar
face or a STEP of a part, and imports it into the library (optionally queued).

## Non-negotiable invariants

1. **Onshape API calls are precious.** Onshape has unpublished per-endpoint
   rate limits (429 + `Retry-After`) AND *annual* per-user caps (2,500/yr on
   free plans). Every read goes through the TTL cache in
   `services/onshape/client.ts`; all geometry work is batched into **one**
   FeatureScript evaluation per operation. Never add a per-item API call loop.
2. **Onshape tokens never reach the browser.** OAuth tokens live in
   `onshape_accounts` (RLS: own row only); all Onshape calls happen in API
   routes. The panel only ever holds a BearParts Supabase session.
3. **The iframe has no cookies.** Third-party cookie rules block our session
   cookies inside cad.onshape.com, so the panel uses a localStorage session
   (`lib/supabase/panel-client.ts`), signs in via popup
   (`/onshape/signin` posts tokens back with postMessage, same-origin checked),
   and calls `/api/onshape/*` routes with `Authorization: Bearer`
   (`lib/supabase/bearer.ts`). `/onshape/panel` + `/api/onshape` are public in
   `proxy.ts`; the routes enforce auth themselves.
4. **There is no face-DXF REST endpoint.** DXF comes from a FeatureScript eval
   (`face-export.ts`: plane + per-edge analytic curves) projected to 2D and
   written by our own writer (`dxf-builder.ts`, `$INSUNITS=1`, R12 entities our
   analyzer reads back). STEP is the async translations API with backoff
   polling (`api.ts exportStep`).
5. **Mock mode is the dev path.** `ONSHAPE_MOCK=1` makes `backend.ts` serve
   canned data (fixtures in `services/onshape/fixtures/`) so the whole panel
   flow works without credentials. `scripts/test-onshape-smoke.mjs` runs the
   full flow against the dev server; keep it green.

## Structure

- `services/onshape/config.ts` — env (`ONSHAPE_CLIENT_ID/SECRET`, `ONSHAPE_MOCK`,
  API base default `https://cad.onshape.com/api/v12`), scope `OAuth2Read`.
- `oauth.ts` — authorize/exchange/refresh (oauth.onshape.com), token upsert,
  `getValidAccessToken` refreshes when <2 min left.
- `client.ts` — fetch + LRU TTL cache + in-flight dedupe. `api.ts` — real REST
  (context, planar faces, shaded views, featurescript evals, STEP translation).
  `backend.ts` — mock-aware dispatch; routes import backend, never api.
- `fs-value.ts` — BTFSValue response tree → plain JS (SI units collapse to numbers).
- Panel: `components/onshape/panel-app.tsx` (derived/keyed state, no
  set-state-in-effect), `onshape-bridge.ts` (postMessage: `applicationInit`
  handshake → `SELECTION` events (payload undocumented — parsed tolerantly,
  logged), `requestSelection` fallback, origin-checked against the `server`
  query param).
- Import lands via `/api/onshape/import` →
  `services/library-upload.service.ts` (shared with the library upload action);
  no subsystem chosen → root "Onshape imports" folder.

## Extension registration (dev portal)

OAuth app redirect: `<origin>/api/onshape/callback`. Extension: location
"Element right panel", context "Part Studio", action URL
`<origin>/onshape/panel?documentId={$documentId}&wvm={$workspaceOrVersion}&wvmid={$workspaceOrVersionId}&elementId={$elementId}`
(Onshape auto-appends `server`, `userId`, etc.). `{$partId}` is NOT available
at this location — part identity comes from selection or the parts list.
