import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "@/services/dxf/analysis.service";
import { keyDimensionsFromAnalysis } from "@/services/dimensions/key-dimensions";
import { circle, dxf, filletedRect, lwpolyline, rect } from "@/services/dxf/__tests__/fixtures";
import { buildDxfSheet } from "../dxf-sheet";
import { MAX_ORDINATES, MAX_TOTAL_ORDINATES, ordinateValues } from "../dxf-plan";
import { boxesOverlap } from "../collision";
import { fmtIn } from "../format";
import type { DrawingMeta } from "../notes";
import { sheetToPdf } from "../pdf-writer";
import type { TextShape } from "../primitives";
import { DIA, textBox } from "../text-metrics";

const meta: DrawingMeta = {
  title: "Test plate",
  drafter: "Greg",
  date: "2026-11-20",
  material: "1/8 5052 aluminum",
  thicknessIn: 0.125,
  quantity: 2,
  revision: "v1",
  fileName: "Test plate.dxf",
  unitsNote: null,
};

function sheetFor(text: string) {
  const { entities, analysis } = analyzeDxfText(text);
  return { analysis, ...buildDxfSheet(entities, analysis, meta) };
}

const texts = (shapes: { kind: string }[]) => shapes.filter((s): s is TextShape => s.kind === "text");

const BEARING_PLATE = dxf({
  insunits: 1,
  entities: [
    filletedRect(0, 0, 6, 3, 0.25),
    circle(3, 1.5, 0.5625),
    ...[[0.375, 0.375], [5.625, 0.375], [0.375, 2.625], [5.625, 2.625]].map(([x, y]) => circle(x, y, 0.0795)),
    filletedRect(0.75, 0.75, 1, 0.5, 0.125),
  ],
});

describe("DXF drawing sheet", () => {
  it("shows every key dimension the verify flow checks", () => {
    const { analysis, sheet, plan } = sheetFor(BEARING_PLATE);
    const all = texts(sheet.shapes).map((t) => t.text).join("\n");
    const { width: W, height: H } = analysis.boundingBox;
    for (const d of keyDimensionsFromAnalysis(analysis, { thicknessIn: meta.thicknessIn })) {
      const value = fmtIn(d.nominal);
      if (d.kind === "hole_diameter") expect(all).toContain(`${DIA}${value}`);
      else if (d.kind === "hole_spacing" || d.kind === "edge_distance") {
        // DXF sheets locate holes by ordinates from the datum: pitch and
        // hole-to-edge are differences of printed ordinates / the overall size
        const derivable = [[...plan.xs, W], [...plan.ys, H]].some((vals) =>
          vals.some((p) => vals.some((q) => Math.abs(Math.abs(p - q) - d.nominal) < 0.0015)),
        );
        expect(derivable, `${d.label} ${value}`).toBe(true);
      } else expect(all).toContain(value);
    }
  });

  it("prints the shared shop tolerances in the title block", () => {
    const all = texts(sheetFor(BEARING_PLATE).sheet.shapes).map((t) => t.text).join("\n");
    expect(all).toContain(".XXX  ±.010");
    expect(all).toContain(`HOLE ${DIA}  ±.005`);
    expect(all).toContain("DIMENSIONS ARE IN INCHES");
  });

  it("calls out holes and radii once per group with counts", () => {
    const all = texts(sheetFor(BEARING_PLATE).sheet.shapes).map((t) => t.text);
    expect(all).toContain(`4X ${DIA}.159 THRU`);
    expect(all).toContain("(10-32 TAP)");
    expect(all).toContain("4X R.125");
    expect(all).toContain("4X R.250");
    expect(all.filter((t) => t.includes(".159 THRU"))).toHaveLength(1);
  });

  it("never overlaps text", () => {
    for (const sample of [BEARING_PLATE, manyHoles()]) {
      const boxes = texts(sheetFor(sample).sheet.shapes).map((t) => textBox(t));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it("uses ordinates from the lower-left datum without repeating values", () => {
    const { plan } = sheetFor(BEARING_PLATE);
    expect(plan.holeMode).toBe("ordinate");
    expect(plan.xs[0]).toBe(0);
    expect(new Set(plan.xs).size).toBe(plan.xs.length);
    expect(plan.xs).not.toContain(6); // overall width is a linear dim, not an ordinate
    expect(plan.xs).toEqual(expect.arrayContaining([0.375, 0.75, 1.75, 3, 5.625]));
  });

  it("switches to a hole table when ordinates would crowd", () => {
    const { plan, sheet } = sheetFor(manyHoles());
    expect(plan.holeMode).toBe("table");
    const all = texts(sheet.shapes).map((t) => t.text);
    expect(all).toContain("HOLE TABLE");
    expect(all).toContain("A1");
  });

  it("notes profile geometry it can't dimension (splines/ellipses)", () => {
    const ellipse = ["0", "ELLIPSE", "8", "0", "10", "2", "20", "1", "11", "1", "21", "0", "40", "0.5", "41", "0", "42", String(Math.PI * 2)].join("\n");
    const notes = sheetFor(dxf({ insunits: 1, entities: [rect(0, 0, 4, 2), ellipse] })).plan.notes.join(" ").toUpperCase();
    expect(notes).toContain("UNDIMENSIONED PROFILE GEOMETRY PER CAD FILE TEST PLATE.DXF");
    const clean = sheetFor(BEARING_PLATE).plan.notes.join(" ");
    expect(clean).not.toContain("UNDIMENSIONED");
  });

  it("gives a gusset's size as far-edge ordinates instead of long extension lines", () => {
    const { plan } = sheetFor(dxf({ insunits: 1, entities: [lwpolyline([[0, 0], [3, 0], [0, 3]]), circle(0.6, 0.6, 0.1)] }));
    expect(plan.xs).toEqual([0, 0.6, 3]);
    expect(plan.ys).toEqual([0, 0.6, 3]);
  });

  it("writes a vector PDF", () => {
    const pdf = new Uint8Array(sheetToPdf(sheetFor(BEARING_PLATE).sheet, { title: "t" }));
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.byteLength).toBeLessThan(200_000);
  });
});

describe("ordinateValues", () => {
  it("always starts at the datum and drops the far edge", () => {
    expect(ordinateValues([1, 0.5, 0.5004, 6, 0], 0, 6)).toEqual([0, 0.5, 1]);
    expect(ordinateValues([], 0, 6)).toEqual([0]);
  });
  it("threshold is a sane number", () => {
    expect(MAX_ORDINATES).toBeGreaterThanOrEqual(8);
    expect(MAX_TOTAL_ORDINATES).toBeGreaterThanOrEqual(MAX_ORDINATES);
  });
});

function manyHoles(): string {
  const ents = [filletedRect(0, 0, 9, 5, 0.25)];
  for (const [cx, cy, r] of [[2.5, 2.5, 1.5], [6.5, 2.5, 1.25]]) {
    ents.push(circle(cx, cy, 0.5));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      ents.push(circle(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.0795));
    }
  }
  return dxf({ insunits: 1, entities: ents });
}
