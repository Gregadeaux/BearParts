import { describe, expect, it } from "vitest";
import { eigenSym3, recognizeModelFeatures } from "@/services/dimensions/model-features";
import { holedPlate, revolve } from "./mesh-fixtures";

// flange ⌀3.5 × .25, boss ⌀2.5 with a .100-wide ⌀2.3 groove at .75, ⌀1.4 bore thru, length 1.2
const TURNED: [number, number][] = [
  [0, 0.7], [1.2, 0.7], [1.2, 1.25], [0.85, 1.25], [0.85, 1.15], [0.75, 1.15],
  [0.75, 1.25], [0.25, 1.25], [0.25, 1.75], [0, 1.75],
];

const PLATE_HOLES: [number, number, number][] = [
  [0.375, 0.375, 0.201], [5.625, 2.625, 0.201], // corner holes
  [2.625, 1.125, 0.5], // center bore
  [1.875, 0.375, 0.159], [3.375, 0.375, 0.159], [1.875, 1.875, 0.159], [3.375, 1.875, 0.159], // 4X on a bolt circle
];

describe("recognizeModelFeatures — turned part", () => {
  const m = revolve(TURNED);
  const f = recognizeModelFeatures(m.positions, m.faceIds);

  it("finds the bore and each outside diameter", () => {
    const bores = f.cylinders.filter((c) => c.kind === "bore");
    expect(bores).toHaveLength(1);
    expect(bores[0].diameter).toBeCloseTo(1.4, 3);
    expect(bores[0].blind).toBe(false);
    const ods = f.cylinders.filter((c) => c.kind === "boss").map((c) => +c.diameter.toFixed(3)).sort();
    expect(ods).toEqual([2.3, 2.5, 2.5, 3.5]);
    expect(f.cylinders.every((c) => c.full && Math.abs(c.axis.x) > 0.9999)).toBe(true);
  });

  it("reports the turned profile: steps, groove, shoulders", () => {
    const t = f.turned!;
    expect(t).not.toBeNull();
    expect(t.extent[0]).toBeCloseTo(0, 4);
    expect(t.extent[1]).toBeCloseTo(1.2, 4);
    expect(t.grooves).toHaveLength(1);
    expect(t.grooves[0].rootDiameter).toBeCloseTo(2.3, 3);
    expect(t.grooves[0].start).toBeCloseTo(0.75, 4);
    expect(t.grooves[0].width).toBeCloseTo(0.1, 4);
    expect(t.shoulders.map((s) => +s.toFixed(4))).toEqual([0, 0.25, 0.75, 0.85, 1.2]);
    expect(f.otherAreaFraction).toBe(0);
  });

  it("detects a blind bore and its depth", () => {
    const cup = revolve([[0, 0], [0.4, 0], [0.4, 0.5], [1, 0.5], [1, 1], [0, 1]]);
    const g = recognizeModelFeatures(cup.positions, cup.faceIds);
    const bore = g.cylinders.find((c) => c.kind === "bore")!;
    expect(bore.diameter).toBeCloseTo(1, 3);
    expect(bore.blind).toBe(true);
    expect(bore.extent[1] - bore.extent[0]).toBeCloseTo(0.6, 4);
    expect(g.holes[0].thru).toBe(false);
  });
});

describe("recognizeModelFeatures — drilled plate", () => {
  const m = holedPlate(6, 3, 0.25, 0.75, PLATE_HOLES);
  const f = recognizeModelFeatures(m.positions, m.faceIds);

  it("groups holes by size with counts, all THRU", () => {
    const summary = f.holes.map((h) => [+h.diameter.toFixed(3), h.count, h.thru]);
    expect(summary).toEqual([[0.5, 1, true], [0.201, 2, true], [0.159, 4, true]]);
    expect(f.holes.every((h) => Math.abs(h.axis.z) > 0.9999)).toBe(true);
  });

  it("recognizes the bolt circle (equal spacing about a common center)", () => {
    const bc = f.holes.find((h) => h.count === 4)!.boltCircle!;
    expect(bc.diameter).toBeCloseTo(2 * Math.hypot(0.75, 0.75), 4);
    expect(bc.center.x).toBeCloseTo(2.625, 4);
    expect(bc.center.y).toBeCloseTo(1.125, 4);
    expect(f.holes.find((h) => h.count === 2)!.boltCircle).toBeNull();
  });

  it("sees six bounding planes and nothing unrecognized", () => {
    expect(f.planes).toHaveLength(6);
    expect(f.turned).toBeNull();
    expect(f.otherAreaFraction).toBe(0);
  });
});

describe("eigenSym3", () => {
  it("sorts eigenvalues ascending with matching vectors", () => {
    const { values, vectors } = eigenSym3([2, 0, 0, 0, 5, 0, 0, 0, 1]);
    expect(values.map((v) => +v.toFixed(6))).toEqual([1, 2, 5]);
    expect(Math.abs(vectors[0][2])).toBeCloseTo(1);
  });
});
