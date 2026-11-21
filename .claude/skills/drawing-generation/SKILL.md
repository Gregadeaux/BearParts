---
name: drawing-generation
description: Drafting conventions and invariants for the dimensioned-drawing PDF generator (DXF flat profiles, STEP/STL multi-view sheets). Use when touching src/services/drawing, src/components/drawing, or anything that changes what a generated drawing shows.
---

# Dimensioned drawing (PDF) conventions

Pipeline: `DrawingButton` (dialog: thickness/material/drafter) → `download-drawing.ts`
fetches the part file via a signed URL → **lazy** `import()` of
`services/drawing/generate.ts` (+ occt for STEP) → pure layout builds a `Sheet`
(vector shapes in sheet inches, y-up) → `pdf-writer.ts` (the only jsPDF user) →
download `"<part name> - drawing.pdf"`. Everything is client-side; layout code is
pure and runs in vitest/Node.

Decisions that must stay consistent:

1. **Sheet:** ANSI A (11×8.5) landscape, 0.375" border, title block bottom right
   (title, drawn by, date YYYY-MM-DD, material, thickness, qty, scale, units INCHES,
   sheet 1 OF 1, rev, CAD file, size A). Tolerance block: "UNLESS OTHERWISE
   SPECIFIED … .XXX ±tol, HOLE ⌀ ±tol, DO NOT SCALE DRAWING". **Tolerances come from
   `DEFAULT_TOLERANCE_IN` / `HOLE_TOLERANCE_IN` in `services/dimensions/key-dimensions.ts`**
   — never hardcode them; the verify flow uses the same constants. Third-angle
   symbol only on multi-view sheets.
2. **Text:** uppercase Helvetica, 0.12" capitals for dims/notes (Y14.2 min),
   three-decimal inch values without leading zero (`.250`), ordinate datum `0`.
   Widths come from `text-metrics.ts` (jsPDF's own table) so layout = output.
   The **⌀ glyph is drawn as vector strokes** (standard PDF fonts lack it); `±`
   and `°` are WinAnsi and render as text.
3. **Lines:** thick 0.6 mm object lines, thin 0.3 mm dims/ext/center/leaders,
   filled 3:1 arrowheads, 1/16" extension gaps, 1/8" overrun, first dim 3/8" off.
4. **Scale:** largest of 2:1, 1:1, 1:2, 1:4, … that fits (`pickScale`). Isometric
   is always labeled NOT TO SCALE.
5. **DXF → one view, no isometric.** Thickness goes in the title block and note 1
   (`MATERIAL: …, THK .125.`; blank → "NOT SPECIFIED"). Geometry is the true
   vector entities. Datum = lower-left of the bounding box.
   - Overall width/height as linear dims above/right; if the outline barely
     reaches that side (gusset hypotenuse) the size becomes a far-edge ordinate
     instead (`overallAsOrdinates`) — never both.
   - Holes and contour points (sharp corners, fillet virtual sharps, centers of
     non-fillet arcs) located by deduplicated **ordinates** (X below, Y left),
     labels spread with jogged extension lines. One leader callout per hole group
     (`4X ⌀.201 THRU` + `(#10 FREE FIT / 1/4-20 TAP)` — ambiguous matches all
     listed), one per radius group (`8X R.125`).
   - >12 ordinates on an axis, >20 total, or illegible spacing → **hole table**
     (tags A1…, X/Y/SIZE); if profile points still don't fit they're dropped.
   - Any contour not located (splines/ellipses, loose lines, dropped points) adds
     `UNDIMENSIONED PROFILE GEOMETRY PER CAD FILE <name>.DXF`. Unit guesses add a
     truthful units note.
   - Callouts are placed by a collision search (`CalloutPlacer`): text never
     overlaps text or lines; prefers outside the part and out of ordinate bands.
6. **STEP/STL → FRONT/TOP/RIGHT (third angle, Z up, front looks +Y) + ISOMETRIC**,
   vector hidden-line removal in pure JS (`mesh-topology.ts` + `hlr.ts`: software
   depth buffer, model edges + interpolated silhouettes of curved faces; tangent
   edges and hidden lines not drawn). STEP edges come from **B-rep face
   boundaries** (occt `brep_faces`) — never draw edges inside one face. A TOP that
   draws identically to FRONT is dropped (`viewsMatch`).
   - **STEP feature recognition** lives in `services/dimensions/model-features.ts`
     (shared with the verify flow): per-face plane/cylinder fits, bore vs boss,
     coaxial merge, hole patterns + bolt circles, blind/thru, turned profile
     (steps, grooves, shoulders). STL has no faces → overall dims only.
   - **Turned parts** are rotated axis-horizontal (FRONT side view, RIGHT circle
     view): axis center line, overall length on top, shoulder/groove-wall
     ordinates from the left end face, each distinct OD once (end steps as
     linear ⌀ beside the view, others as an inside dimension line with the value
     on a leader), coaxial bores + bolt pattern (`6X ⌀.276 THRU` / `EQ SP ON ⌀2.953
     B.C.`, bolt circle as a center line) in RIGHT.
   - **Other parts** are rotated so the main hole axis is Z: holes called out in the
     view down their axis (only if visible there), located by ordinates above/left
     of TOP (bolt circles by their center). Overall L/W/H as before.
   - THRU only when no bottom face was found; depth (↧, vector glyph) only when
     every hole in the pattern is blind with the same depth; otherwise neither.
   - The `UNDIMENSIONED GEOMETRY PER CAD MODEL` note is dropped only when every
     face is a recognized plane/cylinder and everything got dimensioned
     (`model-complete.ts`); fillets, chamfers, cones, hidden holes keep it.
7. **Units for 3D:** one rule shared with verification — `modelScaleToInches`
   (`services/dimensions/model-size.ts`): STEP is tessellated in mm by occt (any
   source unit), STL is read as mm unless the part says inches (and the sheet notes
   that assumption). The drawing's STEP loader (`step-mesh.ts`) tessellates finer
   than the viewer (0.2 rad) so holes draw round.
8. PDF parts get no button. Heavy modules load only on click.
