import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "../analysis.service";
import { arc, circle, dxf, filletedRect, line, rect } from "./fixtures";

describe("analyzeDxfText", () => {
  it("classifies standard holes in an inch-unit plate", () => {
    const text = dxf({
      insunits: 1,
      entities: [
        rect(0, 0, 6, 3),
        circle(1, 1, 0.159 / 2), // 10-32 tap
        circle(2, 1, 0.196 / 2), // #10 close fit
        circle(3, 1, 0.201 / 2), // #10 free / 1/4-20 tap (ambiguous)
        circle(4.5, 1.5, 1.125 / 2), // bearing bore
      ],
    });
    const { analysis } = analyzeDxfText(text);

    expect(analysis.units).toBe("in");
    expect(analysis.unitsSource).toBe("header");
    expect(analysis.holes).toHaveLength(4);

    const [tap, close, ambiguous, bearing] = analysis.holes;
    expect(tap.matches[0].label).toBe("10-32 tap");
    expect(close.matches[0].label).toBe("#10 close fit");
    expect(ambiguous.matches.map((m) => m.label)).toEqual(
      expect.arrayContaining(["#10 free fit", "1/4-20 tap"]),
    );
    expect(bearing.matches[0].kind).toBe("bearing");
    expect(analysis.boundingBox.width).toBeCloseTo(6, 5);
  });

  it("converts mm files to inches using the header", () => {
    const text = dxf({
      insunits: 4,
      entities: [rect(0, 0, 152.4, 76.2), circle(25.4, 25.4, 28.575 / 2)],
    });
    const { analysis } = analyzeDxfText(text);

    expect(analysis.units).toBe("mm");
    expect(analysis.boundingBox.width).toBeCloseTo(6, 4);
    expect(analysis.holes[0].diameter).toBeCloseTo(1.125, 4);
    expect(analysis.holes[0].matches[0].kind).toBe("bearing");
  });

  it("guesses mm from geometry when the header is missing", () => {
    const text = dxf({
      entities: [rect(0, 0, 152.4, 76.2), circle(25.4, 25.4, 28.575 / 2), circle(50, 25, 5.106 / 2)],
    });
    const { analysis } = analyzeDxfText(text);

    expect(analysis.units).toBe("mm");
    expect(analysis.unitsSource).toBe("heuristic");
    expect(analysis.warnings.some((w) => w.includes("guessed millimeters"))).toBe(true);
  });

  it("respects a unit override", () => {
    const text = dxf({ entities: [rect(0, 0, 152.4, 76.2), circle(25.4, 25.4, 28.575 / 2)] });
    const { analysis } = analyzeDxfText(text, "in");
    expect(analysis.units).toBe("in");
    expect(analysis.holes[0].diameter).toBeCloseTo(28.575, 4);
  });

  it("detects a hole drawn as two arcs", () => {
    const text = dxf({
      insunits: 1,
      entities: [rect(0, 0, 4, 4), arc(2, 2, 1.125 / 2, 0, 180), arc(2, 2, 1.125 / 2, 180, 360)],
    });
    const { analysis } = analyzeDxfText(text);
    expect(analysis.holes).toHaveLength(1);
    expect(analysis.holes[0].diameter).toBeCloseTo(1.125, 4);
    expect(analysis.holes[0].matches[0].kind).toBe("bearing");
  });

  it("computes max endmill from pocket fillet radii", () => {
    // 2×1 pocket with 0.125" corner fillets inside a 6×3 plate
    const text = dxf({
      insunits: 1,
      entities: [rect(0, 0, 6, 3), filletedRect(1, 1, 2, 1, 0.125)],
    });
    const { analysis } = analyzeDxfText(text);

    const pocket = analysis.pockets.find((p) => p.kind === "pocket");
    expect(pocket).toBeDefined();
    expect(pocket!.minFilletRadius).toBeCloseTo(0.125, 4);
    expect(pocket!.maxEndmillDiameter).toBeCloseTo(0.25, 4);
    expect(pocket!.sharpCorners).toHaveLength(0);
    expect(analysis.maxEndmillDiameter).toBeCloseTo(0.25, 4);
  });

  it("flags sharp internal corners on square pockets", () => {
    const text = dxf({
      insunits: 1,
      entities: [rect(0, 0, 6, 3), rect(1, 1, 2, 1)],
    });
    const { analysis } = analyzeDxfText(text);

    const pocket = analysis.pockets.find((p) => p.kind === "pocket");
    expect(pocket!.sharpCorners).toHaveLength(4);
    expect(analysis.sharpCornerCount).toBe(4);
    expect(analysis.warnings.some((w) => w.includes("sharp internal corner"))).toBe(true);
  });

  it("does not flag the convex corners of the outer profile", () => {
    const text = dxf({ insunits: 1, entities: [rect(0, 0, 6, 3)] });
    const { analysis } = analyzeDxfText(text);
    expect(analysis.sharpCornerCount).toBe(0);
    expect(analysis.pockets).toHaveLength(0);
  });

  it("flags concave notches in the outer profile", () => {
    // L-shaped profile: one concave (internal) corner at (3,1.5)
    const text = dxf({
      insunits: 1,
      entities: [
        line(0, 0, 6, 0),
        line(6, 0, 6, 1.5),
        line(6, 1.5, 3, 1.5),
        line(3, 1.5, 3, 3),
        line(3, 3, 0, 3),
        line(0, 3, 0, 0),
      ],
    });
    const { analysis } = analyzeDxfText(text);
    const profile = analysis.pockets.find((p) => p.kind === "outer-profile");
    expect(profile).toBeDefined();
    expect(profile!.sharpCorners).toHaveLength(1);
    expect(profile!.sharpCorners[0].x).toBeCloseTo(3, 3);
    expect(profile!.sharpCorners[0].y).toBeCloseTo(1.5, 3);
  });

  it("builds loops from loose lines and arcs", () => {
    // rounded slot outline from 2 lines + 2 arcs, 0.25" wide → hole-free loop
    const text = dxf({
      insunits: 1,
      entities: [
        rect(0, 0, 6, 3),
        line(2, 1, 4, 1),
        arc(4, 1.25, 0.25, 270, 90),
        line(4, 1.5, 2, 1.5),
        arc(2, 1.25, 0.25, 90, 270),
      ],
    });
    const { analysis } = analyzeDxfText(text);
    const slot = analysis.pockets.find((p) => p.kind === "pocket");
    expect(slot).toBeDefined();
    // slot end radius 0.25 → max endmill 0.5 (bounded by end arcs)
    expect(slot!.maxEndmillDiameter).toBeCloseTo(0.5, 3);
  });

  it("groups identical holes", () => {
    const text = dxf({
      insunits: 1,
      entities: [
        rect(0, 0, 6, 3),
        circle(1, 1, 0.098), // 0.196 close fit ×3
        circle(2, 1, 0.098),
        circle(3, 1, 0.098),
        circle(5, 1.5, 0.5625),
      ],
    });
    const { analysis } = analyzeDxfText(text);
    expect(analysis.holeGroups).toHaveLength(2);
    expect(analysis.holeGroups[0].count).toBe(3);
    expect(analysis.holeGroups[1].count).toBe(1);
  });
});
