import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "../analysis.service";
import { largestEndmillWithin, planEndmills } from "../endmill.service";
import { circle, dxf, filletedRect, rect } from "./fixtures";

describe("largestEndmillWithin", () => {
  it("snaps down to catalog sizes", () => {
    expect(largestEndmillWithin(0.25)!.sizeMm).toBe(6); // 6mm = 0.236"
    expect(largestEndmillWithin(0.201)!.sizeMm).toBe(5); // 5mm = 0.197"
    expect(largestEndmillWithin(0.158)!.sizeMm).toBe(4); // 4mm = 0.157"
    expect(largestEndmillWithin(0.03)).toBeNull(); // below 1mm
  });

  it("accepts an exact metric match", () => {
    expect(largestEndmillWithin(6 / 25.4)!.sizeMm).toBe(6);
  });
});

describe("endmill planning (via full analysis)", () => {
  const plate = (extra: string[]) => dxf({ insunits: 1, entities: [rect(0, 0, 6, 3), ...extra] });

  it("recommends one tool plus a two-tool split when bolt holes are the bottleneck", () => {
    const { analysis } = analyzeDxfText(
      plate([
        circle(1, 1, 0.159 / 2), // 10-32 tap — bolt hole, limits single to 4mm
        circle(4.5, 1.5, 1.125 / 2), // bearing bore
        filletedRect(2, 1, 1, 0.5, 0.125), // pocket → ≤0.25" → 6mm
      ]),
    );
    expect(analysis.endmills.single?.sizeMm).toBe(4);
    expect(analysis.endmills.split?.boltHoles.sizeMm).toBe(4);
    expect(analysis.endmills.split?.rest.sizeMm).toBe(6);
  });

  it("skips the split when it buys nothing", () => {
    // only bolt holes — no pockets or big bores, so one 4mm tool is the answer
    const { analysis } = analyzeDxfText(plate([circle(1, 1, 0.159 / 2)]));
    expect(analysis.endmills.single?.sizeMm).toBe(4);
    expect(analysis.endmills.split).toBeNull();
  });

  it("bearing bores belong to the big tool, not the bolt-hole tool", () => {
    const { analysis } = analyzeDxfText(
      plate([circle(3, 1.5, 1.125 / 2), circle(1, 1, 0.196 / 2)]),
    );
    // rest limited only by the 1.125" bore → 12mm; bolt holes need 4mm
    expect(analysis.endmills.split?.rest.sizeMm).toBe(12);
    expect(analysis.endmills.split?.boltHoles.sizeMm).toBe(4);
  });

  it("returns no plan for a bare profile", () => {
    const { analysis } = analyzeDxfText(plate([]));
    expect(analysis.endmills.single).toBeNull();
    expect(analysis.endmills.split).toBeNull();
  });

  it("warns when a hole is smaller than the smallest endmill", () => {
    const { analysis } = analyzeDxfText(plate([circle(1, 1, 0.02)])); // ⌀0.04"
    expect(analysis.endmills.single).toBeNull();
    expect(analysis.warnings.some((w) => w.includes("1mm"))).toBe(true);
  });

  it("planEndmills treats unmatched small holes as bolt holes", () => {
    const plan = planEndmills(
      [{ center: { x: 0, y: 0 }, diameter: 0.19, matches: [] }],
      [
        {
          loopIndex: 0,
          kind: "pocket",
          minFilletRadius: 0.125,
          maxEndmillDiameter: 0.25,
          sharpCorners: [],
        },
      ],
    );
    expect(plan.split?.boltHoles.sizeMm).toBe(4); // 0.189" limit → 4mm
    expect(plan.split?.rest.sizeMm).toBe(6);
  });
});
