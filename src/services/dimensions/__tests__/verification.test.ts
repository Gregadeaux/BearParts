import { describe, expect, it } from "vitest";
import type { KeyDimension } from "../key-dimensions";
import {
  checkReading,
  gradeDimension,
  markRevisions,
  overallResult,
  parseMeasurement,
  sanitizeMeasurements,
  withoutFeatures,
} from "../verification";
import { dimensionHint } from "../format";
import { asModelSize, toInchesSize } from "../model-size";
import { keyDimensionsForPart } from "../part-dimensions";
import { parseThicknessIn } from "../thickness";

describe("parseThicknessIn", () => {
  it("reads decimals and fractions", () => {
    expect(parseThicknessIn("0.25")).toBe(0.25);
    expect(parseThicknessIn('.125"')).toBe(0.125);
    expect(parseThicknessIn("1/4")).toBe(0.25);
    expect(parseThicknessIn("1 1/2 in")).toBe(1.5);
    expect(parseThicknessIn(0.09)).toBe(0.09);
  });

  it("rejects blanks, zero, and nonsense", () => {
    expect(parseThicknessIn("")).toBeNull();
    expect(parseThicknessIn("0")).toBeNull();
    expect(parseThicknessIn("thick")).toBeNull();
    expect(parseThicknessIn(null)).toBeNull();
    expect(parseThicknessIn("1/0")).toBeNull();
  });
});

const length: KeyDimension = { id: "length", kind: "length", label: "Overall length", nominal: 4, tolerance: 0.01 };
const hole: KeyDimension = { id: "hole-0.201", kind: "hole_diameter", label: "Hole ⌀", nominal: 0.201, tolerance: 0.005, count: 4 };

describe("parseMeasurement", () => {
  it("reads caliper-style input", () => {
    expect(parseMeasurement("4.26")).toBe(4.26);
    expect(parseMeasurement(".201")).toBe(0.201);
    expect(parseMeasurement("4,26")).toBe(4.26);
    expect(parseMeasurement(' 4.26" ')).toBe(4.26);
    expect(parseMeasurement("4.")).toBe(4);
  });

  it("rejects blanks and junk", () => {
    expect(parseMeasurement("")).toBeNull();
    expect(parseMeasurement("abc")).toBeNull();
    expect(parseMeasurement("-1")).toBeNull();
    expect(parseMeasurement("1.2.3")).toBeNull();
  });
});

describe("overallResult", () => {
  it("pass only when every dimension is measured and in tolerance", () => {
    expect(overallResult([gradeDimension(length, 4.005), gradeDimension(hole, 0.2)])).toBe("pass");
  });

  it("a skip makes it incomplete", () => {
    expect(overallResult([gradeDimension(length, 4.005), gradeDimension(hole, null)])).toBe("incomplete");
    expect(overallResult([])).toBe("incomplete");
  });

  it("a miss fails even with skips", () => {
    expect(overallResult([gradeDimension(length, 4.02), gradeDimension(hole, null)])).toBe("fail");
  });
});

describe("sanitizeMeasurements", () => {
  it("re-grades whatever the client claimed", () => {
    const [row] = sanitizeMeasurements([{ ...length, measured: 4.5, pass: true, deviation: 0 }]);
    expect(row).toMatchObject({ measured: 4.5, pass: false, deviation: 0.5 });
  });

  it("keeps skips as null and preserves count / note", () => {
    const [row] = sanitizeMeasurements([{ ...hole, note: "1/4-20 tap", measured: null }]);
    expect(row).toMatchObject({ measured: null, pass: null, deviation: null, count: 4, note: "1/4-20 tap" });
  });

  it("never persists figure geometry", () => {
    const withHoles = {
      ...hole,
      feature: { type: "holes" as const, centers: [{ x: 1, y: 1 }], diameter: 0.201 },
    };
    const [row] = sanitizeMeasurements([{ ...withHoles, measured: 0.2 }]);
    expect(row).not.toHaveProperty("feature");
    const [stripped] = withoutFeatures([gradeDimension(withHoles, 0.2)]);
    expect(stripped).not.toHaveProperty("feature");
    expect(stripped).toMatchObject({ id: "hole-0.201", measured: 0.2, pass: true });
  });

  it("throws on malformed input", () => {
    expect(() => sanitizeMeasurements([])).toThrow();
    expect(() => sanitizeMeasurements("nope")).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, kind: "radius", measured: 1 }])).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, nominal: -1, measured: 1 }])).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, measured: "4" }])).toThrow();
  });

  it("rejects impossible readings the same way the input does", () => {
    expect(() => sanitizeMeasurements([{ ...length, measured: 0 }])).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, measured: 501 }])).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, measured: 500 }])).not.toThrow();
  });

  it("keeps the post-reveal revision flags and still grades from `measured`", () => {
    const [row] = sanitizeMeasurements([{ ...length, measured: 4.005, revised: true, firstMeasured: 4.5 }]);
    expect(row).toMatchObject({ measured: 4.005, pass: true, revised: true, firstMeasured: 4.5 });
    const [wasSkipped] = sanitizeMeasurements([{ ...length, measured: 4, revised: true, firstMeasured: null }]);
    expect(wasSkipped).toMatchObject({ revised: true, firstMeasured: null });
  });

  it("drops a stray firstMeasured without the flag, and rejects a malformed revision", () => {
    const [row] = sanitizeMeasurements([{ ...length, measured: 4, firstMeasured: 3 }]);
    expect(row).not.toHaveProperty("firstMeasured");
    expect(row).not.toHaveProperty("revised");
    expect(() => sanitizeMeasurements([{ ...length, measured: 4, revised: "yes" }])).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, measured: 4, revised: true }])).toThrow();
    expect(() => sanitizeMeasurements([{ ...length, measured: 4, revised: true, firstMeasured: -2 }])).toThrow();
  });
});

describe("blind entry", () => {
  it("checkReading: blank is just 'not yet', impossible input gets a neutral message", () => {
    expect(checkReading("")).toEqual({ value: null, problem: null });
    expect(checkReading("  ")).toEqual({ value: null, problem: null });
    expect(checkReading("4.255")).toEqual({ value: 4.255, problem: null });
    expect(checkReading("abc").problem).toBe("Numbers only, in inches");
    expect(checkReading("0").problem).toBe("Has to be more than 0");
    expect(checkReading("-3").problem).toBe("Numbers only, in inches");
    expect(checkReading("812").problem).toMatch(/Too big/);
    expect(checkReading("500")).toEqual({ value: 500, problem: null });
  });

  it("checkReading never depends on the part: same input, same answer, no numbers echoed back", () => {
    for (const raw of ["0", "abc", "9999", "4.2"]) {
      const { problem } = checkReading(raw);
      expect(problem ?? "").not.toMatch(/\d\.\d/); // no nominal-like values in messages
    }
  });

  it("markRevisions flags only readings that changed after the reveal", () => {
    const rows = [gradeDimension(length, 4.005), gradeDimension(hole, 0.2)];
    expect(markRevisions(rows, null)).toEqual(rows); // not revealed yet: nothing to flag
    const same = markRevisions(rows, { length: 4.005, "hole-0.201": 0.2 });
    expect(same.some((r) => r.revised)).toBe(false);
    const changed = markRevisions(rows, { length: 4.5, "hole-0.201": 0.2 });
    expect(changed[0]).toMatchObject({ revised: true, firstMeasured: 4.5, measured: 4.005 });
    expect(changed[1].revised).toBeUndefined();
  });

  it("the entry-step hint never carries the hole match (it gives the nominal away)", () => {
    const withNote = { ...hole, note: "#10 free fit / 1/4-20 tap" };
    expect(dimensionHint(withNote)).toBe("Measure the worst one");
    expect(dimensionHint({ ...withNote, count: 1 })).toBe("Hole diameter");
    expect(dimensionHint(length)).not.toMatch(/\d/);
  });

  it("filling in a skipped reading after the reveal counts as a revision", () => {
    const [row] = markRevisions([gradeDimension(length, 4)], { length: null });
    expect(row).toMatchObject({ revised: true, firstMeasured: null });
    const [cleared] = markRevisions([gradeDimension(length, null)], { length: 4.1 });
    expect(cleared).toMatchObject({ revised: true, firstMeasured: 4.1, measured: null });
  });
});

describe("model size", () => {
  it("STEP is millimeters out of OpenCascade", () => {
    expect(toInchesSize({ x: 101.6, y: 50.8, z: 6.35 }, "step")).toEqual({ x: 4, y: 2, z: 0.25 });
  });

  it("STL is mm unless the part says inches", () => {
    expect(toInchesSize({ x: 25.4, y: 12.7, z: 2.54 }, "stl", "unknown")).toEqual({ x: 1, y: 0.5, z: 0.1 });
    expect(toInchesSize({ x: 1, y: 0.5, z: 0.1 }, "stl", "in")).toEqual({ x: 1, y: 0.5, z: 0.1 });
  });

  it("validates the cached jsonb", () => {
    expect(asModelSize({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
    expect(asModelSize({ x: 1, y: "2", z: 3 })).toBeNull();
    expect(asModelSize(null)).toBeNull();
  });
});

describe("keyDimensionsForPart", () => {
  it("STEP without a cached box needs measuring; PDFs have nothing", () => {
    const base = { analysis: null, thicknessIn: null };
    expect(keyDimensionsForPart({ ...base, fileType: "step", modelSize: null })).toBeNull();
    expect(keyDimensionsForPart({ ...base, fileType: "stl", modelSize: { x: 1, y: 2, z: 3 } })).toHaveLength(3);
    expect(keyDimensionsForPart({ ...base, fileType: "pdf", modelSize: null })).toEqual([]);
  });
});
