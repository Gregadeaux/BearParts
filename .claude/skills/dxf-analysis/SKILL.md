---
name: dxf-analysis
description: Conventions and invariants for the DXF parsing/analysis domain layer. Use when touching src/services/dxf or anything that consumes DxfAnalysis.
---

# DXF analysis conventions

Decisions that must stay consistent:

1. **Everything downstream of `analysis.service.ts` is in inches.** Unit conversion
   happens once, in `analyzeDxfText` (via `scaleEntity`). Viewer, analyzers, and DB
   all speak inches. Never re-convert.
2. **Units resolution order:** user override → DXF `$INSUNITS` header → heuristic
   (score hole-table matches + plausible part size in both interpretations) →
   assume inches with a warning. Implemented in `units.service.ts`.
3. **The hole table lives only in `machining-standards.ts`.** To support a new
   bolt/bearing, add a row there — never hardcode diameters elsewhere.
   Match tolerance is ±0.005".
4. **Ambiguous diameters report all matches**, sorted by deviation (e.g. 0.201" is
   both "1/4-20 tap" and "#10 free fit"). UI shows the best match with the rest as
   alternates. Never silently pick one.
5. **Endmill rule:** max endmill diameter = 2 × smallest concave-from-the-tool
   fillet radius. Loops are normalized CCW; for internal cutouts concave = left
   turns (`concaveSign = 1`), for the outer profile concave = right turns
   (`concaveSign = -1`). Sharp concave corners are flagged, never averaged in.
6. **Endmill recommendations are metric** (`endmill.service.ts`): snap raw inch
   limits DOWN to the shop's catalog (1–12mm) and display "5mm", never inches.
   The shop interpolates ALL holes with endmills (no drill bits), so hole
   diameters (−0.001" clearance) constrain tooling too. Always offer two plans:
   a single do-everything tool, and a bolt-holes-tool + bigger-rest-tool split
   (bolt hole = tap/close/free match, or unmatched ≤0.28"); omit the split when
   the rest tool wouldn't be bigger. Bearing bores count as "rest", not bolt.
7. **Holes can be circles OR closed loops of same-center arcs** (`loopAsCircle`).
   Full-circle loops are excluded from pocket analysis.
8. **Domain layer is pure and isomorphic** — no React, no Supabase, no Node APIs in
   `src/services/dxf`. It runs in browser and server identically. Keep it that way
   so upload preview (client) and any server-side re-analysis agree.
9. **Tests use the fixture builder** (`__tests__/fixtures.ts`) to author DXF text —
   don't check in binary DXF fixtures.

## Key dimensions & part verification (`src/services/dimensions/`)

Same rules as the DXF layer: pure, isomorphic, inches, unit-tested.

- **Tolerances live only in `key-dimensions.ts`**: `DEFAULT_TOLERANCE_IN` ±0.010"
  (length / width / height / thickness), `HOLE_TOLERANCE_IN` ±0.005" (hole ⌀).
  Pass = |measured − nominal| ≤ tolerance (deviation rounded to 0.0001" so float
  noise never flips a result). Nominals are rounded to the thou — what the
  student sees is exactly what's judged.
- **Nominals are derived, never typed.** DXF (`keyDimensionsFromAnalysis`):
  length = larger bbox extent, width = smaller, one entry per hole group
  (count + best match label; ties like 0.201" list every match; groups that
  round to the same thou merge), thickness only when `thickness_in` is set.
  STEP/STL (`keyDimensionsFromBox`): length ≥ width ≥ height from the model
  box; a known thickness equal to the height replaces it, otherwise both show.
  PDFs have nothing → no Verify button.
- **3D units** (`model-size.ts`): occt-import-js outputs STEP in **mm** (its
  default `linearUnit`); STL is unitless and treated as **mm** (slicer
  convention) unless `parts.units = 'in'`. The box is measured client-side on
  first Verify and cached in `parts.model_size_in` (inches).
- **Results**: any out-of-tolerance → `fail`; else any skipped → `incomplete`;
  else `pass`. The server action re-grades (`sanitizeMeasurements`) before
  saving. Verification never blocks finishing a part.
- **Blind entry; reveal on the summary.** The entry step shows only the label,
  a "how to measure" hint, the highlighted figure, and the input — never the
  nominal, tolerance, live pass/fail, or the hole-match note ("1/4-20 tap"
  gives the size away), and the figure never prints a number. Impossible input
  gets a neutral message from `checkReading` (blank / non-numeric / ≤ 0 /
  > `MAX_READING_IN` 500") — nothing nominal-dependent. Everything is revealed
  on the summary once every dimension is entered or skipped.
- **Post-reveal edits are flagged, not hidden.** A reading changed after the
  summary was first shown is saved with `revised: true` and `firstMeasured`
  (the pre-reveal value; null = it was skipped) via `markRevisions`; summary
  and history show "re-measured". Re-editing a step stays blind.
- **STEP holes** (`step-holes.ts`): STEP parts get the box dimensions plus
  hole sizes from B-rep feature recognition (`model-features.ts` →
  `holes`), merged at the thou per axis direction, ranked by count × size,
  capped at `MAX_HOLE_STEPS` (4) — the summary says how many sizes were left
  out. The shop-table match (`classifyDiameter`) is the note (reveal only).
  Face ids come from the viewer's own parse (`parseStep` keeps them via
  `flattenOcct`) — no extra tessellation. Recognition runs lazily when Verify
  opens and is cached in `parts.model_size_in` as
  `{ x, y, z, holes: [{ d, n, axis, c }], holesFound, holesV }` (≤ 6 groups,
  ≤ 160 centers each, evenly subsampled). Rows without the current
  `HOLES_CACHE_VERSION` re-derive once; bump it when recognition or trims
  change. Recognition trouble → box only. STL stays box-only (no faces).
- **Figures** (`figure.ts`, `figure-3d.ts`, `bore-view.ts`, `components/verify/*-figure.tsx`): optional
  `KeyDimension.feature` says what to highlight — `extent` (model axis),
  `holes` (DXF group centers), or `bores` (3D axis + centers, viewed straight
  down the axis with the group ringed). DXF draws the real profile (tall profiles turned a
  quarter to fill the wide figure); STEP/STL reuse the page viewer's mesh
  (never re-parsed) in an orthographic view turned only ABOUT the measured
  axis so it stays true-length and unskewed. `feature` is display-only and is
  stripped before saving (`withoutFeatures`, and the server drops it anyway).
