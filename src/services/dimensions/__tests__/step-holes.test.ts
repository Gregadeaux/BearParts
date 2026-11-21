import { describe, expect, it } from "vitest";
import { holedPlate, holedTube } from "@/services/drawing/__tests__/mesh-fixtures";
import { recognizeModelFeatures } from "../model-features";
import {
  asCachedHoles,
  axisKey,
  deriveStepHoles,
  holesFromFeatures,
  HOLES_CACHE_VERSION,
  keyDimensionsFromHoles,
  MAX_CACHED_CENTERS,
  MAX_HOLE_STEPS,
  spreadSample,
  type CachedHoleGroup,
  type CachedHoles,
} from "../step-holes";
import { asModelSizeCache, modelSizeCache } from "../model-size";
import { partDimensions } from "../part-dimensions";
import { withoutFeatures, gradeDimension } from "../verification";
import { boreView } from "../bore-view";

// 6 × 3 × 0.25 plate: ⌀0.5 ×1, ⌀0.201 ×2, ⌀0.159 ×4
const PLATE_HOLES: [number, number, number][] = [
  [0.375, 1.125, 0.5],
  [5.625, 0.375, 0.201], [5.625, 2.625, 0.201],
  [1.875, 0.375, 0.159], [3.375, 0.375, 0.159], [1.875, 1.875, 0.159], [3.375, 1.875, 0.159],
];
const plate = holedPlate(6, 3, 0.25, 0.75, PLATE_HOLES);

/**
 * The real 2x1 post (/parts/15e51973…): 6.875 × 2 × 1, wall .093; 13 rows at
 * .500 pitch from .4375 (7/16) off each end; columns .5 / 1.0 / 1.5 across
 * the 2" faces, one centered column on the 1" faces; every hole through both walls.
 */
export function post2x1() {
  const gx = [0, ...Array.from({ length: 14 }, (_, k) => 0.1875 + 0.5 * k), 6.875];
  const gy = [0, 0.093, 0.375, 0.625, 0.875, 1.125, 1.375, 1.625, 1.907, 2];
  const gz = [0, 0.093, 0.375, 0.625, 0.907, 1];
  const rows = Array.from({ length: 13 }, (_, k) => k + 1);
  const wide = rows.flatMap((i) => [2, 4, 6].map((j) => [i, j] as [number, number]));
  const narrow = rows.map((i) => [i, 2] as [number, number]);
  return holedTube(6.875, 2, 1, 0.093, gx, gy, gz, { cells: wide, d: 0.196, both: true }, { cells: narrow, d: 0.196, both: true });
}

const group = (d: number, n: number, axis: [number, number, number] = [0, 0, 1]): CachedHoleGroup => ({
  d,
  n,
  axis,
  c: Array.from({ length: n }, (_, i) => [i, 0, 0] as [number, number, number]),
});
const holes = (groups: CachedHoleGroup[], found = groups.length): CachedHoles => ({
  groups,
  found,
  patterns: [],
  patternsFound: 0,
});

describe("the 2x1 post (physical holes + pattern checks)", () => {
  const m = post2x1();
  const h = holesFromFeatures(recognizeModelFeatures(m.positions, m.faceIds));
  const { dims } = keyDimensionsFromHoles(h);

  it("counts holes through both walls once: 39× on the 2\" faces, 13× on the 1\" faces", () => {
    expect(h.groups.map((g) => [g.d, g.n, axisKey(g.axis)])).toEqual([
      [0.196, 39, "z"],
      [0.196, 13, "y"],
    ]);
  });

  it("asks lengthwise pitch, hole to end, hole to side edge — once each across both faces", () => {
    const pat = dims.filter((d) => d.kind !== "hole_diameter");
    expect(pat.map((d) => [d.label, d.nominal, d.note ?? null])).toEqual([
      ["Hole spacing — along length", 0.5, null],
      ["Hole to end", 0.438, "7/16"],
      ["Hole to side edge", 0.5, null],
    ]);
    expect(pat.every((d) => d.tolerance === 0.01)).toBe(true);
    expect(new Set(dims.map((d) => d.id)).size).toBe(dims.length);
  });

  it("figure spans: two adjacent holes .500 apart; the end edge .4375 from its hole", () => {
    const [spacing, end] = dims.filter((d) => d.kind !== "hole_diameter");
    const dist = (f: typeof spacing.feature) =>
      f?.type === "span" ? Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1], f.b[2] - f.a[2]) : NaN;
    expect(spacing.feature).toMatchObject({ type: "span", ends: "holes" });
    expect(dist(spacing.feature)).toBeCloseTo(0.5, 3);
    expect(end.feature).toMatchObject({ type: "span", ends: "edge" });
    expect(dist(end.feature)).toBeCloseTo(0.4375, 3);
    // the end edge is an end of the tube: ±L/2 along x in the bbox-centered frame
    const f = end.feature!;
    expect(f.type === "span" && Math.abs(Math.abs(f.a[0]) - 6.875 / 2)).toBeCloseTo(0, 3);
  });
});

describe("holesFromFeatures (plate)", () => {
  const h = holesFromFeatures(recognizeModelFeatures(plate.positions, plate.faceIds));

  it("one group per size, most important (count × size) first", () => {
    expect(h.found).toBe(3);
    expect(h.groups.map((g) => [g.d, g.n])).toEqual([
      [0.159, 4],
      [0.5, 1],
      [0.201, 2],
    ]);
  });

  it("centers sit on the face the holes open into, relative to the bbox center", () => {
    expect(h.groups.find((g) => g.d === 0.5)!.c).toEqual([[0.375 - 3, 1.125 - 1.5, 0.125]]);
  });

  it("pattern checks: most important pattern first, repeated values asked once", () => {
    expect(h.patterns.map((p) => [p.k, p.w, p.v, p.d])).toEqual([
      ["s", 0, 1.5, 0.159], ["e", 0, 1.875, 0.159], ["e", 1, 0.375, 0.159], // ⌀.159 2×2 (across pitch 1.5 = dup)
      ["e", 0, 0.375, 0.5], ["e", 1, 1.125, 0.5], // ⌀.5 single: edge distances only, no pitch
      ["s", 1, 2.25, 0.201], // ⌀.201 column: its .375 end/side distances were already asked
    ]);
    const { dims, omitted } = keyDimensionsFromHoles(h);
    expect(dims.filter((d) => d.kind !== "hole_diameter")).toHaveLength(4); // MAX_PATTERN_STEPS
    expect(omitted).toBe(2);
  });
});

describe("deriveStepHoles", () => {
  it("scales raw millimeters to inches before recognizing", () => {
    const mm = plate.positions.map((v) => v * 25.4);
    const { groups } = deriveStepHoles(mm, plate.faceIds, 1 / 25.4);
    expect(groups.map((g) => g.d).sort()).toEqual([0.159, 0.201, 0.5]);
  });

  it("never throws — junk in, no holes out", () => {
    expect(deriveStepHoles([1, 2, 3], [0], 1)).toEqual({ groups: [], found: 0, patterns: [], patternsFound: 0 });
  });
});

describe("keyDimensionsFromHoles", () => {
  it("maps groups to blind-safe hole dimensions with a stable id, count, note, and figure feature", () => {
    const { dims, omitted } = keyDimensionsFromHoles(holes([group(0.201, 6)]));
    expect(omitted).toBe(0);
    expect(dims[0]).toMatchObject({
      id: "hole-0.201-z",
      kind: "hole_diameter",
      nominal: 0.201,
      tolerance: 0.005,
      count: 6,
      feature: { type: "bores", axis: [0, 0, 1], diameter: 0.201 },
    });
    expect(dims[0].note).toContain("1/4-20 tap");
  });

  it(`caps sizes at ${MAX_HOLE_STEPS} by count × size; omitted adds sizes and pattern checks left out`, () => {
    const groups = [group(0.159, 20), group(1.125, 1), group(0.201, 8), group(0.5, 2), group(0.257, 1), group(0.1, 1)];
    const { dims, omitted } = keyDimensionsFromHoles({ ...holes(groups, 9), patternsFound: 3 });
    expect(dims.map((d) => d.nominal)).toEqual([0.159, 0.201, 1.125, 0.5]);
    expect(omitted).toBe(5 + 3); // 2 trimmed + 3 never cached sizes, 3 never cached checks
  });

  it("feature geometry never reaches the saved record", () => {
    const [dim] = keyDimensionsFromHoles(holes([group(0.201, 2)])).dims;
    expect(withoutFeatures([gradeDimension(dim, 0.2)])[0]).not.toHaveProperty("feature");
  });
});

describe("cache round-trip (parts.model_size_in)", () => {
  const m = post2x1();
  const h = holesFromFeatures(recognizeModelFeatures(m.positions, m.faceIds));
  const cache = modelSizeCache({ x: 6.875, y: 2, z: 1 }, h);
  const v = HOLES_CACHE_VERSION;

  it("v3 carries physical counts + pattern checks and survives JSON + validation unchanged", () => {
    expect(v).toBe(3);
    expect(cache).toMatchObject({ x: 6.875, holesV: 3, holesFound: 2, patternsFound: 3 });
    expect(asModelSizeCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache);
    expect(asCachedHoles(JSON.parse(JSON.stringify(cache)))).toEqual(h);
    expect(JSON.stringify(cache).length).toBeLessThan(12_000); // stays small
  });

  it("box-only, v2 (per-wall counts), or versionless rows re-derive", () => {
    expect(asCachedHoles({ x: 1, y: 2, z: 3 })).toBeNull();
    expect(asCachedHoles({ ...cache, holesV: 2 })).toBeNull();
    expect(asCachedHoles({ x: 1, y: 2, z: 3, holes: [] })).toBeNull();
    expect(asCachedHoles({ x: 1, y: 2, z: 3, holes: [], holesV: v })).toEqual({
      groups: [],
      found: 0,
      patterns: [],
      patternsFound: 0,
    });
  });

  it("drops malformed groups/patterns and re-applies the trims", () => {
    const trimmed = asCachedHoles({
      holesV: v,
      holes: [{ d: -1, n: 1, axis: [0, 0, 1], c: [] }, { d: 0.2, n: 1, axis: [0, 1], c: [] }, group(0.3, 400)],
      patterns: [{ k: "x", w: 0, v: 1 }, ...h.patterns],
    })!;
    expect(trimmed.groups).toHaveLength(1);
    expect(trimmed.groups[0].c).toHaveLength(MAX_CACHED_CENTERS);
    expect(trimmed.groups[0].n).toBe(400);
    expect(trimmed.patterns).toEqual(h.patterns);
  });

  it("trimmed highlights are spread over the whole pattern, not the first N", () => {
    const picked = spreadSample(Array.from({ length: 400 }, (_, i) => i), 160);
    expect(picked).toHaveLength(160);
    expect(picked[159]).toBeGreaterThan(390);
  });
});

describe("partDimensions for 3D parts", () => {
  const base = { analysis: null, thicknessIn: null, modelSize: { x: 6, y: 3, z: 0.25 } };

  it("STEP: box, then hole sizes, then pattern checks, with the omitted count", () => {
    const r = partDimensions({ ...base, fileType: "step", holes: holes([group(0.201, 2)], 6) });
    expect(r.dims!.map((d) => d.kind)).toEqual(["length", "width", "height", "hole_diameter"]);
    expect(r.omittedHoles).toBe(5);
  });

  it("STL stays box-only; STEP without holes falls back to the box", () => {
    expect(partDimensions({ ...base, fileType: "stl", holes: holes([group(0.2, 1)]) }).dims).toHaveLength(3);
    expect(partDimensions({ ...base, fileType: "step", holes: holes([]) }).dims).toHaveLength(3);
  });
});

describe("boreView", () => {
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  it("looks straight down the hole axis with the long side horizontal, reading like the part", () => {
    const v = boreView({ x: 10, y: 4, z: 0.25 }, [0, 0, 1]);
    expect(v.width).toBeCloseTo(10);
    expect(v.rightVec.map((n) => Math.round(n) + 0)).toEqual([1, 0, 0]);
    expect(v.upVec.map((n) => Math.round(n) + 0)).toEqual([0, 1, 0]);
  });

  it("is a right-handed screen frame for any axis", () => {
    for (const axis of [[0, 0, 1], [1, 0, 0], [0, -1, 0], [0.6, 0.8, 0]] as [number, number, number][]) {
      const v = boreView({ x: 3, y: 2, z: 1 }, axis);
      expect(dot(cross(v.rightVec, v.upVec), v.cameraDir)).toBeCloseTo(1);
    }
  });
});
