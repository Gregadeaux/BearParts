import { describe, expect, it } from "vitest";
import { holedPlate } from "@/services/drawing/__tests__/mesh-fixtures";
import { recognizeModelFeatures, type ModelFeatures } from "../model-features";
import {
  asCachedHoles,
  axisKey,
  deriveStepHoles,
  holeGroupsFromFeatures,
  HOLES_CACHE_VERSION,
  keyDimensionsFromHoles,
  MAX_CACHED_CENTERS,
  MAX_HOLE_STEPS,
  spreadSample,
  type CachedHoleGroup,
} from "../step-holes";
import { asModelSizeCache, modelSizeCache } from "../model-size";
import { partDimensions } from "../part-dimensions";
import { withoutFeatures, gradeDimension } from "../verification";
import { boreView } from "../bore-view";

// 6 × 3 × 0.25 plate: ⌀0.5 ×1, ⌀0.201 ×2, ⌀0.159 ×4 (same layout the drawing tests use)
const PLATE_HOLES: [number, number, number][] = [
  [0.375, 1.125, 0.5],
  [5.625, 0.375, 0.201], [5.625, 2.625, 0.201],
  [1.875, 0.375, 0.159], [3.375, 0.375, 0.159], [1.875, 1.875, 0.159], [3.375, 1.875, 0.159],
];
const plate = holedPlate(6, 3, 0.25, 0.75, PLATE_HOLES);

const group = (d: number, n: number, axis: [number, number, number] = [0, 0, 1]): CachedHoleGroup => ({
  d,
  n,
  axis,
  c: Array.from({ length: n }, (_, i) => [i, 0, 0] as [number, number, number]),
});

describe("holeGroupsFromFeatures", () => {
  const f = recognizeModelFeatures(plate.positions, plate.faceIds);
  const { groups, found } = holeGroupsFromFeatures(f, [3, 1.5, 0.125]);

  it("one group per size, most important (count × size) first", () => {
    expect(found).toBe(3);
    expect(groups.map((g) => [g.d, g.n])).toEqual([
      [0.159, 4], // 0.636
      [0.5, 1], // 0.5
      [0.201, 2], // 0.402
    ]);
    expect(groups.every((g) => Math.abs(g.axis[2]) === 1)).toBe(true);
  });

  it("member centers are mid-depth, relative to the bbox center", () => {
    const big = groups.find((g) => g.d === 0.5)!;
    expect(big.c).toEqual([[0.375 - 3, 1.125 - 1.5, 0]]);
    const tapped = groups.find((g) => g.d === 0.201)!;
    expect(tapped.c.map((c) => c[0]).sort()).toEqual([2.625, 2.625]);
  });

  it("merges patterns that round to the same thou on the same axis, keeps other axes apart", () => {
    const feat = {
      holes: [
        { axis: { x: 0, y: 0, z: 1 }, diameter: 0.2501, count: 2, members: [0, 1], thru: true, boltCircle: null },
        { axis: { x: 0, y: 0, z: 1 }, diameter: 0.2503, count: 1, members: [2], thru: true, boltCircle: null },
        { axis: { x: 1, y: 0, z: 0 }, diameter: 0.25, count: 1, members: [3], thru: true, boltCircle: null },
      ],
      cylinders: [0, 1, 2, 3].map((i) => ({
        axis: i === 3 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 },
        origin: { x: i, y: 0, z: 0 },
        extent: [0, 1] as [number, number],
      })),
    } as unknown as ModelFeatures;
    const merged = holeGroupsFromFeatures(feat, [0, 0, 0]);
    expect(merged.found).toBe(2);
    expect(merged.groups.map((g) => [g.d, g.n, axisKey(g.axis)])).toEqual([
      [0.25, 3, "z"],
      [0.25, 1, "x"],
    ]);
  });
});

describe("deriveStepHoles", () => {
  it("scales raw millimeters to inches before recognizing", () => {
    const mm = plate.positions.map((v) => v * 25.4);
    const { groups } = deriveStepHoles(mm, plate.faceIds, 1 / 25.4);
    expect(groups.map((g) => g.d).sort()).toEqual([0.159, 0.201, 0.5]);
  });

  it("never throws — junk in, no holes out", () => {
    expect(deriveStepHoles([1, 2, 3], [0], 1)).toEqual({ groups: [], found: 0 });
    expect(deriveStepHoles([], [], 1).groups).toEqual([]);
  });
});

describe("keyDimensionsFromHoles", () => {
  it("maps groups to blind-safe hole dimensions with a stable id, count, note, and figure feature", () => {
    const { dims, omitted } = keyDimensionsFromHoles({ groups: [group(0.201, 6)], found: 1 });
    expect(omitted).toBe(0);
    expect(dims[0]).toMatchObject({
      id: "hole-0.201-z",
      kind: "hole_diameter",
      label: "Hole ⌀",
      nominal: 0.201,
      tolerance: 0.005,
      count: 6,
      feature: { type: "bores", axis: [0, 0, 1], diameter: 0.201 },
    });
    expect(dims[0].note).toContain("1/4-20 tap"); // shop table, revealed on the summary only
  });

  it(`caps the flow at ${MAX_HOLE_STEPS} sizes by count × size and reports the rest`, () => {
    const groups = [group(0.159, 20), group(1.125, 1), group(0.201, 8), group(0.5, 2), group(0.257, 1), group(0.1, 1)];
    const { dims, omitted } = keyDimensionsFromHoles({ groups, found: 9 });
    expect(dims.map((d) => d.nominal)).toEqual([0.159, 0.201, 1.125, 0.5]);
    expect(omitted).toBe(5); // 2 trimmed here + 3 never cached
  });

  it("feature geometry never reaches the saved record", () => {
    const [dim] = keyDimensionsFromHoles({ groups: [group(0.201, 2)], found: 1 }).dims;
    expect(withoutFeatures([gradeDimension(dim, 0.2)])[0]).not.toHaveProperty("feature");
  });
});

describe("cache round-trip (parts.model_size_in)", () => {
  const holes = { groups: [group(0.201, 2), group(0.5, 1)], found: 2 };
  const cache = modelSizeCache({ x: 6, y: 3, z: 0.25 }, holes);
  const v = HOLES_CACHE_VERSION;

  it("survives JSON + validation unchanged, keeping x/y/z as they are", () => {
    expect(cache).toEqual({ x: 6, y: 3, z: 0.25, holes: holes.groups, holesFound: 2, holesV: v });
    expect(asModelSizeCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache);
    expect(asCachedHoles(JSON.parse(JSON.stringify(cache)))).toEqual(holes);
  });

  it("box-only or older-version rows mean 'not computed yet'; an empty list means 'none found'", () => {
    expect(asCachedHoles({ x: 1, y: 2, z: 3 })).toBeNull();
    expect(asCachedHoles({ x: 1, y: 2, z: 3, holes: [], holesFound: 0 })).toBeNull(); // no version
    expect(asCachedHoles({ x: 1, y: 2, z: 3, holes: [], holesV: v - 1 })).toBeNull();
    expect(asCachedHoles({ x: 1, y: 2, z: 3, holes: [], holesV: v })).toEqual({ groups: [], found: 0 });
    expect(asModelSizeCache({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("drops malformed groups and re-applies the trims", () => {
    const trimmed = asCachedHoles({
      holesV: v,
      holes: [{ d: -1, n: 1, axis: [0, 0, 1], c: [] }, { d: 0.2, n: 1, axis: [0, 1], c: [] }, group(0.3, 400)],
    })!;
    expect(trimmed.groups).toHaveLength(1);
    expect(trimmed.groups[0].c).toHaveLength(MAX_CACHED_CENTERS);
    expect(trimmed.groups[0].n).toBe(400); // the count stays true
    expect(asModelSizeCache({ holes: [] })).toBeNull(); // no box, no cache
  });

  it("trimmed highlights are spread over the whole pattern, not the first N", () => {
    const picked = spreadSample(Array.from({ length: 400 }, (_, i) => i), 160);
    expect(picked).toHaveLength(160);
    expect(picked[0]).toBe(0);
    expect(picked[159]).toBeGreaterThan(390);
    expect(spreadSample([1, 2, 3], 160)).toEqual([1, 2, 3]);
  });
});

describe("partDimensions for 3D parts", () => {
  const base = { analysis: null, thicknessIn: null, modelSize: { x: 6, y: 3, z: 0.25 } };
  const holes = { groups: [group(0.201, 2)], found: 6 };

  it("STEP: box then holes, with the omitted count", () => {
    const r = partDimensions({ ...base, fileType: "step", holes });
    expect(r.dims!.map((d) => d.kind)).toEqual(["length", "width", "height", "hole_diameter"]);
    expect(r.omittedHoles).toBe(5);
  });

  it("STL stays box-only; STEP without holes falls back to the box", () => {
    expect(partDimensions({ ...base, fileType: "stl", holes }).dims).toHaveLength(3);
    expect(partDimensions({ ...base, fileType: "step", holes: { groups: [], found: 0 } }).dims).toHaveLength(3);
    expect(partDimensions({ ...base, fileType: "step" }).dims).toHaveLength(3);
  });
});

describe("boreView", () => {
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  it("looks straight down the hole axis with the long side horizontal, reading like the part", () => {
    const v = boreView({ x: 10, y: 4, z: 0.25 }, [0, 0, 1]);
    expect(v.cameraDir).toEqual([0, 0, 1]);
    expect(v.width).toBeCloseTo(10);
    expect(v.height).toBeCloseTo(4);
    // plain top view: +x right, +y up (an upside-down frame turned engraved text over)
    expect(v.rightVec.map((n) => Math.round(n) + 0)).toEqual([1, 0, 0]);
    expect(v.upVec.map((n) => Math.round(n) + 0)).toEqual([0, 1, 0]);
  });

  it("is a right-handed screen frame for any axis (right × up points at the camera)", () => {
    for (const axis of [[0, 0, 1], [1, 0, 0], [0, -1, 0], [0.6, 0.8, 0]] as [number, number, number][]) {
      const v = boreView({ x: 3, y: 2, z: 1 }, axis);
      expect(dot(cross(v.rightVec, v.upVec), v.cameraDir)).toBeCloseTo(1);
      expect(dot(v.rightVec, v.cameraDir)).toBeCloseTo(0);
      expect(dot(v.upVec, v.cameraDir)).toBeCloseTo(0);
    }
  });
});
