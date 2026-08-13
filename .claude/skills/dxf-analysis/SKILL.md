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
