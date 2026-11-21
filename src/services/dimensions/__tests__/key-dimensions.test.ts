import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "@/services/dxf/analysis.service";
import { circle, dxf, rect } from "@/services/dxf/__tests__/fixtures";
import {
  axesBySize,
  checkDimension,
  DEFAULT_TOLERANCE_IN,
  holeCentersFor,
  formatInches,
  HOLE_TOLERANCE_IN,
  keyDimensionsFromAnalysis,
  keyDimensionsFromBox,
  type KeyDimension,
} from "../key-dimensions";
import type { DxfAnalysis } from "@/types/analysis";

const plate = (extra: string[]) =>
  analyzeDxfText(dxf({ insunits: 1, entities: [rect(0, 0, 3, 6), ...extra] })).analysis;

describe("keyDimensionsFromAnalysis", () => {
  it("length is the larger extent, width the smaller", () => {
    const dims = keyDimensionsFromAnalysis(plate([]));
    expect(dims.map((d) => [d.id, d.nominal, d.tolerance])).toEqual([
      ["length", 6, DEFAULT_TOLERANCE_IN],
      ["width", 3, DEFAULT_TOLERANCE_IN],
    ]);
  });

  it("one entry per hole group with count, hole tolerance, and the match label", () => {
    const dims = keyDimensionsFromAnalysis(
      plate([
        circle(1, 1, 0.266 / 2),
        circle(2, 1, 0.266 / 2),
        circle(1, 4, 0.266 / 2),
        circle(2, 4, 0.266 / 2),
        circle(1.5, 3, 1.125 / 2),
      ]),
    );
    const holes = dims.filter((d) => d.kind === "hole_diameter");
    expect(holes).toHaveLength(2);
    expect(holes[0]).toMatchObject({
      id: "hole-0.266",
      label: "Hole ⌀",
      nominal: 0.266,
      tolerance: HOLE_TOLERANCE_IN,
      count: 4,
      note: '1/4" free fit',
    });
    expect(holes[1]).toMatchObject({ id: "hole-1.125", count: 1 });
  });

  it("lists every tied match instead of silently picking one", () => {
    const dims = keyDimensionsFromAnalysis(plate([circle(1, 1, 0.201 / 2)]));
    const hole = dims.find((d) => d.kind === "hole_diameter")!;
    expect(hole.note).toContain("1/4-20 tap");
    expect(hole.note).toContain("#10 free fit");
  });

  it("includes thickness only when known", () => {
    expect(keyDimensionsFromAnalysis(plate([])).some((d) => d.kind === "thickness")).toBe(false);
    const dims = keyDimensionsFromAnalysis(plate([]), { thicknessIn: 0.25 });
    expect(dims.find((d) => d.kind === "thickness")).toMatchObject({ nominal: 0.25 });
    expect(keyDimensionsFromAnalysis(plate([]), { thicknessIn: null })).toHaveLength(2);
  });

  it("merges hole groups that round to the same thou", () => {
    const analysis = {
      boundingBox: { min: { x: 0, y: 0 }, max: { x: 2, y: 1 }, width: 2, height: 1 },
      holeGroups: [
        { diameter: 0.2501, count: 2, matches: [] },
        { diameter: 0.2503, count: 3, matches: [] },
      ],
    } as unknown as DxfAnalysis;
    const holes = keyDimensionsFromAnalysis(analysis).filter((d) => d.kind === "hole_diameter");
    expect(holes).toEqual([
      { id: "hole-0.250", kind: "hole_diameter", label: "Hole ⌀", nominal: 0.25, tolerance: 0.005, count: 5 },
    ]);
  });

  it("rounds nominals to the thou and skips an empty profile", () => {
    const analysis = {
      boundingBox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 4.24996 },
      holeGroups: [],
    } as unknown as DxfAnalysis;
    expect(keyDimensionsFromAnalysis(analysis)).toEqual([
      {
        id: "length",
        kind: "length",
        label: "Overall length",
        nominal: 4.25,
        tolerance: 0.01,
        feature: { type: "extent", axis: "y" },
      },
    ]);
  });
});

describe("figure features", () => {
  it("DXF length/width point at the axis they span", () => {
    const tall = keyDimensionsFromAnalysis(plate([])); // 3 wide (x) × 6 tall (y)
    expect(tall.find((d) => d.kind === "length")?.feature).toEqual({ type: "extent", axis: "y" });
    expect(tall.find((d) => d.kind === "width")?.feature).toEqual({ type: "extent", axis: "x" });
  });

  it("a hole dimension carries exactly the holes of its group", () => {
    const dims = keyDimensionsFromAnalysis(
      plate([circle(1, 1, 0.266 / 2), circle(2, 1, 0.266 / 2), circle(1.5, 3, 1.125 / 2)]),
    );
    const small = dims.find((d) => d.id === "hole-0.266")!;
    expect(small.feature).toMatchObject({ type: "holes", diameter: 0.266 });
    const centers = small.feature?.type === "holes" ? small.feature.centers : [];
    expect(centers.map((c) => [c.x, c.y]).sort()).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it("holeCentersFor groups by the rounded thou, so merged groups highlight together", () => {
    const holes = [
      { center: { x: 0, y: 0 }, diameter: 0.2501, matches: [] },
      { center: { x: 1, y: 0 }, diameter: 0.2503, matches: [] },
      { center: { x: 2, y: 0 }, diameter: 0.5, matches: [] },
    ];
    expect(holeCentersFor(holes, 0.25)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it("thickness on a flat profile has no feature to point at", () => {
    const dims = keyDimensionsFromAnalysis(plate([]), { thicknessIn: 0.25 });
    expect(dims.find((d) => d.kind === "thickness")?.feature).toBeUndefined();
  });

  it("box dimensions remember which model axis they came from", () => {
    const dims = keyDimensionsFromBox({ x: 2, y: 0.5, z: 7 });
    expect(dims.map((d) => [d.kind, d.feature])).toEqual([
      ["length", { type: "extent", axis: "z" }],
      ["width", { type: "extent", axis: "x" }],
      ["height", { type: "extent", axis: "y" }],
    ]);
  });

  it("a thickness that replaces the height inherits its axis; a separate one has none", () => {
    const same = keyDimensionsFromBox({ x: 6, y: 0.25, z: 2 }, { thicknessIn: 0.25 });
    expect(same.find((d) => d.kind === "thickness")?.feature).toEqual({ type: "extent", axis: "y" });
    const bent = keyDimensionsFromBox({ x: 6, y: 2, z: 1.5 }, { thicknessIn: 0.125 });
    expect(bent.find((d) => d.kind === "thickness")?.feature).toBeUndefined();
  });

  it("axesBySize orders largest first and keeps x, y, z on ties", () => {
    expect(axesBySize({ x: 1, y: 3, z: 2 })).toEqual(["y", "z", "x"]);
    expect(axesBySize({ x: 2, y: 2, z: 1 })).toEqual(["x", "y", "z"]);
  });
});

describe("keyDimensionsFromBox", () => {
  it("sorts the extents into length ≥ width ≥ height", () => {
    const dims = keyDimensionsFromBox({ x: 2, y: 0.5, z: 7 });
    expect(dims.map((d) => [d.kind, d.nominal])).toEqual([
      ["length", 7],
      ["width", 2],
      ["height", 0.5],
    ]);
  });

  it("a thickness equal to the height replaces it", () => {
    const dims = keyDimensionsFromBox({ x: 6, y: 2, z: 0.25 }, { thicknessIn: 0.25 });
    expect(dims.map((d) => d.kind)).toEqual(["length", "width", "thickness"]);
  });

  it("a thickness unlike the height is listed as well (bent bracket)", () => {
    const dims = keyDimensionsFromBox({ x: 6, y: 2, z: 1.5 }, { thicknessIn: 0.125 });
    expect(dims.map((d) => d.kind)).toEqual(["length", "width", "height", "thickness"]);
  });
});

describe("formatInches", () => {
  it("always shows three decimals", () => {
    expect(formatInches(4.25)).toBe("4.250");
    expect(formatInches(0.201)).toBe("0.201");
    expect(formatInches(3)).toBe("3.000");
  });
});

describe("checkDimension", () => {
  const length: KeyDimension = { id: "length", kind: "length", label: "L", nominal: 4.25, tolerance: 0.01 };
  const hole: KeyDimension = { id: "h", kind: "hole_diameter", label: "H", nominal: 0.201, tolerance: 0.005 };

  it("passes exactly at the tolerance edge despite float noise", () => {
    expect(checkDimension(length, 4.26)).toEqual({ pass: true, deviation: 0.01 });
    expect(checkDimension(length, 4.24)).toEqual({ pass: true, deviation: -0.01 });
    expect(checkDimension(hole, 0.206).pass).toBe(true);
  });

  it("fails just outside and reports signed deviation", () => {
    expect(checkDimension(length, 4.261)).toEqual({ pass: false, deviation: 0.011 });
    expect(checkDimension(hole, 0.195)).toEqual({ pass: false, deviation: -0.006 });
  });
});
