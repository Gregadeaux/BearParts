import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "@/services/dxf/analysis.service";
import { circle, dxf, filletedRect, rect } from "@/services/dxf/__tests__/fixtures";
import type { BoundingBox } from "@/types/geometry";
import { dxfHolePatterns } from "../hole-patterns";
import { fractionNote, MAX_PATTERN_STEPS, patternChecks, patternKeyDimensions, snap64 } from "../pattern-dims";
import { dxfPatternDimensions, keyDimensionsFromAnalysis } from "../key-dimensions";
import { dimensionHint } from "../format";
import { sanitizeMeasurements } from "../verification";
import { edgeLine2D, fitFigure, focusFigure } from "../figure";
import { edgeLine3D, spanFraming, boreView } from "../bore-view";

/** 6 × 3 plate: a 3 × 2 grid of ⌀.2 at x .3/1.3/2.3, y .5/1.5 */
const GRID_PLATE = dxf({
  insunits: 1,
  entities: [filletedRect(0, 0, 6, 3, 0.25), ...[0.3, 1.3, 2.3].flatMap((x) => [circle(x, 0.5, 0.1), circle(x, 1.5, 0.1)])],
});

describe("snap64 / fractionNote", () => {
  it("snaps tube-stock 64ths through mesh noise, leaves other values alone", () => {
    expect(snap64(0.43749998)).toBe(0.4375);
    expect(snap64(0.4)).toBe(0.4);
    expect(fractionNote(0.4375)).toBe("7/16");
    expect(fractionNote(1.3125)).toBe("1-5/16");
    expect(fractionNote(0.5)).toBeUndefined(); // reads exactly already
    expect(fractionNote(0.4)).toBeUndefined();
  });
});

describe("DXF pattern checks", () => {
  const { analysis } = analyzeDxfText(GRID_PLATE);

  it("pitch along, hole to end, hole to side, pitch across (if different)", () => {
    const { dims, omitted } = dxfPatternDimensions(analysis);
    expect(omitted).toBe(0);
    expect(dims.map((d) => [d.kind, d.label, d.nominal])).toEqual([
      ["hole_spacing", "Hole spacing — along length", 1],
      ["edge_distance", "Hole to end", 0.3],
      ["edge_distance", "Hole to side edge", 0.5],
      // across pitch is 1.000 too — the same caliper value, asked once
    ]);
    expect(dims.every((d) => d.tolerance === 0.01 && d.count === undefined)).toBe(true);
  });

  it("are part of the DXF key dimensions, after the hole sizes", () => {
    const kinds = keyDimensionsFromAnalysis(analysis).map((d) => d.kind);
    expect(kinds).toEqual(["length", "width", "hole_diameter", "hole_spacing", "edge_distance", "edge_distance"]);
  });

  it("figure spans: adjacent holes one pitch apart; the datum edge to its nearest hole", () => {
    const [pitch, end] = dxfPatternDimensions(analysis).dims;
    expect(pitch.feature).toMatchObject({ type: "span", ends: "holes", diameter: 0.2 });
    const f = pitch.feature!;
    if (f.type !== "span") throw new Error("span expected");
    expect(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1])).toBeCloseTo(1, 4);
    const e = end.feature!;
    if (e.type !== "span") throw new Error("span expected");
    expect(e.ends).toBe("edge");
    expect(e.a[0]).toBeCloseTo(0, 6); // the x = 0 end of the plate
    expect(e.b[0]).toBeCloseTo(0.3, 4);
  });

  it("skips irregular sets and lone holes' pitch; a single hole still has edge distances", () => {
    const text = dxf({ insunits: 1, entities: [rect(0, 0, 6, 3), circle(1, 1, 0.1), circle(2, 1.2, 0.1), circle(4.1, 2, 0.1), circle(5, 1.5, 0.25)] });
    const checks = patternChecks(dxfHolePatterns(analyzeDxfText(text).analysis));
    expect(checks.map((c) => [c.k, c.w, c.v, c.d])).toEqual([
      ["e", 0, 1, 0.5], // ⌀.5 single: 1.000 from the right end
      ["e", 1, 1.5, 0.5],
    ]);
  });

  it(`caps at ${MAX_PATTERN_STEPS} and reports the rest`, () => {
    const checks = Array.from({ length: 7 }, (_, i) => ({
      k: "e" as const, w: 0 as const, v: 0.25 + i, d: 0.2, axis: [0, 0, 1] as [number, number, number], a: [0, 0, 0] as [number, number, number], b: [1, 0, 0] as [number, number, number],
    }));
    const { dims, omitted } = patternKeyDimensions(checks);
    expect(dims).toHaveLength(MAX_PATTERN_STEPS);
    expect(omitted).toBe(3);
  });
});

describe("blind hints, server validation", () => {
  it("hints say how to measure center distances with calipers — no numbers", () => {
    expect(dimensionHint({ kind: "hole_spacing" })).toBe("Inside jaws across both holes, minus one hole ⌀");
    expect(dimensionHint({ kind: "edge_distance" })).toBe("Edge to near side of hole, plus half the hole ⌀");
    expect(dimensionHint({ kind: "hole_spacing" })).not.toMatch(/\d/);
  });

  it("the server accepts and re-grades the new kinds, dropping figure geometry", () => {
    const [dim] = dxfPatternDimensions(analyzeDxfText(GRID_PLATE).analysis).dims;
    const [row] = sanitizeMeasurements([{ ...dim, measured: 1.02 }]);
    expect(row).toMatchObject({ kind: "hole_spacing", nominal: 1, measured: 1.02, pass: false, deviation: 0.02 });
    expect(row).not.toHaveProperty("feature");
  });
});

describe("span figure math", () => {
  const box = (x0: number, y0: number, x1: number, y1: number): BoundingBox => ({
    min: { x: x0, y: y0 }, max: { x: x1, y: y1 }, width: x1 - x0, height: y1 - y0,
  });
  const size = { width: 340, height: 144 };

  it("2D: zooms so the span fills ~45% of the width, centered on it", () => {
    const fit = fitFigure(box(0, 0, 7, 2), size, 22);
    const f = focusFigure({ x: 0.4375, y: 1 }, { x: 0.9375, y: 1 }, size, 0.196 * 5, fit);
    expect(f.upp).toBeLessThan(fit.upp); // zoomed in
    expect((0.5 / f.upp) / size.width).toBeCloseTo(0.45, 2);
    const [x, , w] = f.viewBox;
    expect(x + w / 2).toBeCloseTo(0.6875);
  });

  it("2D: a long span just shows the whole part", () => {
    const fit = fitFigure(box(0, 0, 7, 2), size, 22);
    expect(focusFigure({ x: 0, y: 1 }, { x: 6.5, y: 1 }, size, 1, fit)).toBe(fit);
  });

  it("2D: the datum edge spans the part, through the edge point, perpendicular to edge→hole", () => {
    expect(edgeLine2D({ x: 0, y: 1 }, { x: 0.4375, y: 1 }, box(0, 0, 7, 2))).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]);
  });

  it("3D: zooms the down-axis view onto the span; the edge line spans the box", () => {
    const view = boreView({ x: 6.875, y: 2, z: 1 }, [0, 0, 1]);
    const s = spanFraming(view, [-3, 0, 0.5], [-2.5, 0, 0.5], size, 0.98, 30);
    expect(s.zoom).toBeGreaterThan(30);
    expect(s.target).toEqual([-2.75, 0, 0.5]);
    expect(spanFraming(view, [-3, 0, 0.5], [3, 0, 0.5], size, 0.98, 60)).toEqual({ zoom: 60, target: [0, 0, 0] });
    const [p, q] = edgeLine3D([-3.4375, 0, 0.5], [-3, 0, 0.5], [0, 0, 1], { x: 6.875, y: 2, z: 1 });
    expect([p[0], q[0]]).toEqual([-3.4375, -3.4375]);
    expect(Math.abs(q[1] - p[1])).toBeCloseTo(2);
  });
});
