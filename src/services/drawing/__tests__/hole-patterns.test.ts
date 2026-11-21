import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "@/services/dxf/analysis.service";
import { recognizeModelFeatures } from "@/services/dimensions/model-features";
import { adjacentHoles, detectGrid, dxfHolePatterns, edgeSpan, modelHolePatterns } from "@/services/dimensions/hole-patterns";
import { circle, dxf, filletedRect } from "@/services/dxf/__tests__/fixtures";
import { edgeText, fraction64, pitchTexts } from "../hole-grid";
import { buildModelSheet } from "../model-sheet";
import type { DrawingMeta } from "../notes";
import { qrMatrix, qrRects, QR_QUIET_MODULES } from "../qr";
import { holedTube } from "./mesh-fixtures";

const grid = (nx: number, ny: number, x0: number, y0: number, p: number, jitter = 0) =>
  Array.from({ length: nx * ny }, (_, i) => ({
    x: x0 + (i % nx) * p + (i % 3 === 0 ? jitter : -jitter),
    y: y0 + Math.floor(i / nx) * p + (i % 2 ? jitter : -jitter),
  }));

describe("detectGrid", () => {
  it("finds a 13×3 grid despite jitter inside the .002 tolerance", () => {
    const g = detectGrid(grid(13, 3, 0.4375, 0.5, 0.5, 0.0008))!;
    expect(g.cols.count).toBe(13);
    expect(g.rows.count).toBe(3);
    expect(g.cols.pitch).toBeCloseTo(0.5, 2);
  });
  it("treats a single row as 1×N", () => {
    const g = detectGrid(grid(5, 1, 1, 0.5, 0.75))!;
    expect([g.cols.count, g.rows.count, g.rows.pitch]).toEqual([5, 1, 0]);
  });
  it("rejects uneven spacing and missing nodes", () => {
    expect(detectGrid([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1.2, y: 0 }])).toBeNull();
    expect(detectGrid(grid(3, 3, 0, 0, 1).slice(1))).toBeNull();
  });
});

const tube = (both: boolean) => {
  const xs = [0, ...Array.from({ length: 12 }, (_, i) => 0.25 + 0.5 * i), 6];
  const g = [0, 0.0625, 0.375, 0.625, 0.9375, 1];
  const cells = Array.from({ length: 11 }, (_, i) => [i + 1, 2] as [number, number]);
  return holedTube(6, 1, 1, 0.0625, xs, g, g, { cells, d: 0.196, both }, both ? { cells, d: 0.196, both } : null);
};

describe("modelHolePatterns", () => {
  it("counts a hole through both tube walls once and calls it through the part", () => {
    const m = tube(true);
    const f = recognizeModelFeatures(m.positions, m.faceIds);
    expect(f.cylinders.filter((c) => c.kind === "bore")).toHaveLength(44); // 11 holes × 2 walls × 2 faces
    expect(f.stacks).toHaveLength(22);
    const pats = modelHolePatterns(f);
    expect(pats.map((p) => p.count)).toEqual([11, 11]);
    expect(pats.every((p) => p.throughPart && p.kind === "row")).toBe(true);
    const along = pats[0].directions![0];
    expect(along.count).toBe(11);
    expect(along.pitch).toBeCloseTo(0.5, 4);
    expect(along.edgeDistance).toBeCloseTo(0.5, 4);
    expect(pats[0].directions![1].edgeDistance).toBeCloseTo(0.5, 4); // centered across the 1" face
  });

  it("knows a hole in one wall is not through the part", () => {
    const m = tube(false);
    const pats = modelHolePatterns(recognizeModelFeatures(m.positions, m.faceIds));
    expect(pats).toHaveLength(1);
    expect(pats[0].count).toBe(11);
    expect(pats[0].throughPart).toBe(false);
  });

  it("gives figure helpers: two adjacent holes and the datum-edge span", () => {
    const m = tube(true);
    const p = modelHolePatterns(recognizeModelFeatures(m.positions, m.faceIds))[0];
    const [a, b] = adjacentHoles(p, 0)!;
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeCloseTo(0.5, 4);
    const span = edgeSpan(p, 0)!;
    expect(Math.hypot(span.edge.x - span.hole.x, span.edge.y - span.hole.y, span.edge.z - span.hole.z)).toBeCloseTo(0.5, 4);
  });
});

describe("dxfHolePatterns", () => {
  it("measures a plate's hole grid from its edges, nearer edge as datum", () => {
    const text = dxf({
      insunits: 1,
      entities: [filletedRect(0, 0, 6, 3, 0.25), ...[0.3, 1.3, 2.3].flatMap((x) => [circle(x, 0.5, 0.1), circle(x, 1.5, 0.1)])],
    });
    const [p] = dxfHolePatterns(analyzeDxfText(text).analysis);
    expect(p.kind).toBe("grid");
    expect(p.count).toBe(6);
    const [along, across] = p.directions!;
    expect([along.dir.x, along.count, +along.pitch.toFixed(3), along.datum, +along.edgeDistance.toFixed(3), +along.farEdgeDistance.toFixed(3)]).toEqual([1, 3, 1, "min", 0.3, 3.7]);
    expect([across.count, +across.pitch.toFixed(3), +across.edgeDistance.toFixed(3)]).toEqual([2, 1, 0.5]);
  });

  it("uses the far edge as datum when the pattern hugs it", () => {
    const text = dxf({ insunits: 1, entities: [filletedRect(0, 0, 6, 3, 0.25), circle(5.5, 1.5, 0.1), circle(5, 1.5, 0.1)] });
    const d = dxfHolePatterns(analyzeDxfText(text).analysis)[0].directions![0];
    expect([d.datum, +d.edgeDistance.toFixed(3)]).toEqual(["max", 0.5]);
  });

  it("reports irregular hole sets without directions", () => {
    const text = dxf({ insunits: 1, entities: [filletedRect(0, 0, 6, 3, 0.25), circle(1, 1, 0.1), circle(2, 1.2, 0.1), circle(4.1, 2, 0.1)] });
    const p = dxfHolePatterns(analyzeDxfText(text).analysis)[0];
    expect([p.kind, p.directions]).toEqual(["irregular", null]);
  });
});

describe("pattern sheet", () => {
  const meta: DrawingMeta = { title: "Tube", drafter: null, date: "2026-11-20", material: null, thicknessIn: null, quantity: null, revision: null, fileName: "Tube.step", unitsNote: null };
  it("dimensions the lengthwise pitch once, not again in the second view", () => {
    const m = tube(true);
    const r = buildModelSheet(m.positions, meta, m.faceIds);
    const dirs = r.holePlans.map((p) => `${p.view}:${p.dims.map((d) => d.dir).join("")}`);
    expect(dirs).toEqual(["front:uv", "top:v"]);
    const texts = r.sheet.shapes.flatMap((s) => (s.kind === "text" ? [s.text] : []));
    expect(texts.filter((t) => t.startsWith("10X .500"))).toHaveLength(1);
    expect(texts.filter((t) => t === "11X ⌀.196 THRU")).toHaveLength(2);
    expect(texts.join(" ")).toContain(".063 (1/16) WALL");
    expect(r.complete).toBe(true);
  });
});

describe("pattern text", () => {
  it("formats repetitive spacing and exact 64ths", () => {
    expect(pitchTexts({ count: 13, pitch: 0.5 })).toEqual(["12X .500 (=6.000)", "12X .500", ".500 TYP"]);
    expect(pitchTexts({ count: 2, pitch: 0.5 })).toEqual([".500"]);
    expect([fraction64(0.4375), fraction64(0.0625), fraction64(1.3125), fraction64(0.5), fraction64(0.4)]).toEqual(["7/16", "1/16", "1-5/16", null, null]);
    expect(edgeText(0.43749999)).toEqual([".438 (7/16)", ".438"]);
  });
});

describe("QR layout", () => {
  it("covers exactly the dark modules inside the quiet zone", () => {
    const m = qrMatrix("https://bearparts.fly.dev/parts/15e51973-cd2f-47df-92e5-a3f674cc2aa4");
    const n = m.length;
    expect(n % 4).toBe(1); // 21 + 4k modules
    const size = 0.95;
    const cell = size / (n + 2 * QR_QUIET_MODULES);
    const rects = qrRects(m, 1, 2, size);
    const dark = m.flat().filter(Boolean).length;
    expect(rects.reduce((s, r) => s + (r.w * r.h) / (cell * cell), 0)).toBeCloseTo(dark, 6);
    const q = QR_QUIET_MODULES * cell;
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(1 + q - 1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(1 + size - q + 1e-9);
      expect(r.y).toBeGreaterThanOrEqual(2 + q - 1e-9);
    }
    // top-left finder pattern: row 0 starts with 7 dark modules at the quiet-zone corner
    expect(rects.some((r) => Math.abs(r.x - (1 + q)) < 1e-9 && Math.abs(r.y - (2 + size - q - cell)) < 1e-9 && Math.abs(r.w - 7 * cell) < 1e-9)).toBe(true);
  });
});
