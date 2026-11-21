import { describe, expect, it } from "vitest";
import { keyDimensionsFromBox } from "@/services/dimensions/key-dimensions";
import { buildTopology } from "../mesh-topology";
import { lineView, VIEWS } from "../hlr";
import { buildModelSheet } from "../model-sheet";
import { fmtIn } from "../format";
import type { DrawingMeta } from "../notes";
import type { TextShape } from "../primitives";
import { boxesOverlap } from "../collision";
import { DIA, textBox } from "../text-metrics";
import { holedPlate, revolve } from "./mesh-fixtures";

/** 12 triangles of an axis-aligned box. */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number[] {
  const p = (x: number, y: number, z: number) => [x ? x1 : x0, y ? y1 : y0, z ? z1 : z0];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d];
  return [
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)), // front (y0)
    ...quad(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)), // back
    ...quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)), // left
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)), // right
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)), // top
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)), // bottom
  ];
}

const onBoundary = (segs: number[], minU: number, maxU: number, minV: number, maxV: number) => {
  const tol = 1e-6;
  for (let i = 0; i < segs.length; i += 4) {
    const [u0, v0, u1, v1] = segs.slice(i, i + 4);
    const vertical = Math.abs(u0 - u1) < tol && (Math.abs(u0 - minU) < tol || Math.abs(u0 - maxU) < tol);
    const horizontal = Math.abs(v0 - v1) < tol && (Math.abs(v0 - minV) < tol || Math.abs(v0 - maxV) < tol);
    if (!vertical && !horizontal) return false;
  }
  return true;
};

describe("hidden-line views", () => {
  it("draws a box as its outline — no triangulation diagonals", () => {
    const topo = buildTopology(box(0, 0, 0, 2, 1, 0.5));
    expect(topo.edgeHard.reduce((s, h) => s + h, 0)).toBe(12);
    const v = lineView(topo, VIEWS.front);
    expect(onBoundary(v.segs, 0, 2, 0, 0.5)).toBe(true);
    expect(v.segs.length / 4).toBeGreaterThanOrEqual(4);
  });

  it("removes edges hidden behind a nearer face", () => {
    // small block directly behind a big one: invisible from the front
    const topo = buildTopology([...box(0, 0, 0, 4, 1, 4), ...box(1, 2, 1, 3, 3, 3)]);
    const v = lineView(topo, VIEWS.front);
    expect(onBoundary(v.segs, 0, 4, 0, 4)).toBe(true);
    // but the top view sees both
    const top = lineView(topo, VIEWS.top);
    expect(onBoundary(top.segs, top.minU, top.maxU, top.minV, top.maxV)).toBe(false);
  });

  it("never treats edges inside one B-rep face as model edges", () => {
    // a 'face' folded 90° (as a coarse chamfer strip can look) is still one face
    const tris = box(0, 0, 0, 1, 1, 1);
    const faceIds = Array.from({ length: tris.length / 9 }, (_, t) => (t < 4 ? 0 : t)); // front+back share id 0
    const noFaces = buildTopology(tris).edgeHard.reduce((s, h) => s + h, 0);
    const withFaces = buildTopology(tris, 30, faceIds).edgeHard.reduce((s, h) => s + h, 0);
    expect(noFaces).toBe(12);
    expect(withFaces).toBe(12); // front/back don't touch: nothing to suppress
    const strip = buildTopology(tris, 30, Array(tris.length / 9).fill(0)).edgeHard.reduce((s, h) => s + h, 0);
    expect(strip).toBe(0);
  });

  it("ignores triangle winding when finding creases", () => {
    const tris = box(0, 0, 0, 1, 1, 1);
    // flip one triangle's winding
    const t = tris.slice(3, 6);
    tris.splice(3, 3, ...tris.slice(6, 9));
    tris.splice(6, 3, ...t);
    expect(buildTopology(tris).edgeHard.reduce((s, h) => s + h, 0)).toBe(12);
  });
});

describe("model sheet with recognized features", () => {
  const meta: DrawingMeta = {
    title: "Hub", drafter: null, date: "2026-11-20", material: null, thicknessIn: null,
    quantity: null, revision: null, fileName: "Hub.step", unitsNote: null,
  };
  const texts = (r: ReturnType<typeof buildModelSheet>) =>
    r.sheet.shapes.filter((s): s is TextShape => s.kind === "text");
  const noOverlap = (r: ReturnType<typeof buildModelSheet>) => {
    const boxes = texts(r).map((t) => textBox(t));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j])).toBe(false);
  };

  it("draws a turned part axis-horizontal in two views with each size once", () => {
    // axis along Z in the model: the sheet must turn it horizontal
    const m = revolve([[0, 0.7], [1.2, 0.7], [1.2, 1.25], [0.85, 1.25], [0.85, 1.15], [0.75, 1.15], [0.75, 1.25], [0.25, 1.25], [0.25, 1.75], [0, 1.75]]);
    const zUp = m.positions.map((_, i, p) => (i % 3 === 0 ? p[i + 1] : i % 3 === 1 ? p[i + 1] : p[i - 2]));
    const r = buildModelSheet(zUp, meta, m.faceIds);
    expect(r.views).toEqual(["front", "right", "iso"]); // TOP would repeat FRONT
    expect(r.size.x).toBeCloseTo(1.2, 3);
    const all = texts(r).map((t) => t.text);
    for (const v of ["1.200", `${DIA}3.500`, `${DIA}2.500`, `${DIA}2.300`, `${DIA}1.400 THRU`, ".250", ".750", ".850"]) {
      expect(all.filter((t) => t === v)).toHaveLength(1);
    }
    expect(r.complete).toBe(true);
    expect(all.join(" ")).not.toContain("UNDIMENSIONED");
    noOverlap(r);
  });

  it("calls out and locates a drilled plate's holes in TOP", () => {
    const m = holedPlate(6, 3, 0.25, 0.75, [
      [0.375, 0.375, 0.201], [5.625, 2.625, 0.201], [2.625, 1.125, 0.5],
      [1.875, 0.375, 0.159], [3.375, 0.375, 0.159], [1.875, 1.875, 0.159], [3.375, 1.875, 0.159],
    ]);
    const r = buildModelSheet(m.positions, meta, m.faceIds);
    const all = texts(r).map((t) => t.text);
    for (const v of [`2X ${DIA}.201 THRU`, `${DIA}.500 THRU`, `4X ${DIA}.159 THRU`, `EQ SP ON ${DIA}2.121 B.C.`, "2.625", "1.125", "5.625"]) {
      expect(all).toContain(v);
    }
    expect(r.complete).toBe(true);
    noOverlap(r);
  });

  it("keeps the CAD-model note when anything is left undimensioned", () => {
    // a partial cylinder (round) is recognized but not dimensioned
    const m = revolve([[0, 0.5], [1, 0.5], [1, 1], [0, 1]], 48);
    const keep = m.faceIds.map((f, t) => (t % 48 < 12 ? f : -1)); // unknown faces → unrecognized area
    const r = buildModelSheet(m.positions, meta, keep);
    expect(r.complete).toBe(false);
    expect(texts(r).map((t) => t.text).join(" ")).toContain("UNDIMENSIONED GEOMETRY");
  });
});

describe("model sheet", () => {
  const meta: DrawingMeta = {
    title: "Block",
    drafter: null,
    date: "2026-11-20",
    material: null,
    thicknessIn: null,
    quantity: null,
    revision: null,
    fileName: "Block.step",
    unitsNote: null,
  };

  it("dimensions overall size once each and labels the views", () => {
    const r = buildModelSheet(box(0, 0, 0, 3, 1.5, 0.75), meta);
    const all = r.sheet.shapes.filter((s): s is TextShape => s.kind === "text").map((t) => t.text);
    for (const d of keyDimensionsFromBox(r.size)) {
      expect(all.filter((t) => t === fmtIn(d.nominal))).toHaveLength(1);
    }
    for (const label of ["FRONT", "TOP", "RIGHT", "ISOMETRIC", "NOT TO SCALE", "THIRD ANGLE"]) {
      expect(all).toContain(label);
    }
    expect(all.join(" ")).toContain("UNDIMENSIONED GEOMETRY PER CAD MODEL BLOCK.STEP");
    expect(r.scale).toBe(1);
  });
});
