# Backlog

Features queued for after user roles ships. Newest ideas at the bottom.

## 1. Part verification flow

A student with a finished part in hand opens a "Verify" flow. It prompts them to
measure key dimensions on the actual part (overall length and width, hole
diameters, etc.) and enter them. This is the check that the part was made
correctly.

Each step shows the actual part (DXF profile or 3D model) with the feature to
measure highlighted, alongside the text label.

Open questions:

- Where do the expected dimensions come from: auto-derived from the DXF analysis
  (bounding box, hole diameters), picked by the designer at submit time, or both?
- What tolerance counts as a pass, and is it per dimension or one shop default?
- What happens on a fail: block "done", flag for a lead, or just record it?
- Does verification become a required step before a part can be marked done?
- STL / STEP / PDF parts have no DXF analysis; do they get manual dimensions or
  skip verification?

## 2. Generate dimensioned drawing (PDF)

A button on a part that generates a PDF engineering drawing following drafting
best practice:

- 3D sources (STEP, Onshape): multiple orthographic views plus an isometric view.
- DXF sources: the flat profile only, no isometric. Thickness is listed in the
  drawing notes / title block rather than drawn.
- Fully dimensioned: every dimension derivable, but no redundant or cluttering
  dimensions.
- Standard symbols (diameter, radius, counts like "4X", centerlines, etc.).
- Title block: part name, drafter, material, and the usual fields (date, scale,
  units, quantity, revision).

Related to item 1: the key dimensions on the drawing and the ones the verify
flow asks for should be the same set, from one shared source.

Open questions:

- Thickness for DXF parts: use a saved value when there is one, otherwise the
  user types it in when generating. Today there is no thickness field: parts
  imported from the Onshape panel only carry it as free text ("0.25 in thick"
  in the version note / material string), and the G-code dialog asks for it
  each time. Adding a real `thickness` column (filled by the Onshape import,
  editable elsewhere, reused by G-code) is likely part of this work.
- Drafting standard and sheet: ASME Y14.5, inches, letter-size landscape?
- Tolerances: a general tolerance note in the title block, or per dimension?
- Is the PDF just downloaded, or also saved as a version document on the
  library part?
