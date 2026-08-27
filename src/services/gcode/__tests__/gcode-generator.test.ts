import { describe, expect, it } from "vitest";
import type { NormalizedEntity, Segment } from "@/types/geometry";
import { loopSignedArea } from "../../dxf/geometry";
import { generateGcode, offsetLoop, type GcodeGenOptions } from "../gcode-generator";
import { parseGcode } from "../gcode-parser";

const OPTS: GcodeGenOptions = {
  toolDiameter: 0.125,
  feed: 60,
  plungeFeed: 20,
  spindleRpm: 18000,
  passDepth: 0.1,
  thickness: 0.25,
  safeZ: 0.25,
  pocketThreshold: 0.3,
};

const squareLoop = (size: number): Segment[] => [
  { kind: "line", a: { x: 0, y: 0 }, b: { x: size, y: 0 } },
  { kind: "line", a: { x: size, y: 0 }, b: { x: size, y: size } },
  { kind: "line", a: { x: size, y: size }, b: { x: 0, y: size } },
  { kind: "line", a: { x: 0, y: size }, b: { x: 0, y: 0 } },
];

describe("offsetLoop", () => {
  it("grows outward offsets and shrinks inward ones", () => {
    const base = Math.abs(loopSignedArea(squareLoop(2)));
    const out = offsetLoop(squareLoop(2), 0.0625)!;
    const inn = offsetLoop(squareLoop(2), -0.0625)!;
    expect(Math.abs(loopSignedArea(out))).toBeGreaterThan(base);
    expect(Math.abs(loopSignedArea(inn))).toBeLessThan(base);
    // sharp corners become rounding arcs on the outward side
    expect(out.filter((s) => s.kind === "arc")).toHaveLength(4);
  });

  it("returns null when a feature is narrower than the tool", () => {
    const tinyCircle: Segment[] = [
      { kind: "arc", a: { x: 0.05, y: 0 }, b: { x: 0.05, y: 0 }, center: { x: 0, y: 0 }, radius: 0.05, ccw: true },
    ];
    expect(offsetLoop(tinyCircle, -0.0625)).toBeNull();
  });
});

describe("generateGcode", () => {
  const plate: NormalizedEntity[] = [
    {
      kind: "polyline",
      closed: true,
      vertices: [
        { x: 0, y: 0, bulge: 0 },
        { x: 4, y: 0, bulge: 0 },
        { x: 4, y: 2, bulge: 0 },
        { x: 0, y: 2, bulge: 0 },
      ],
    },
    { kind: "circle", center: { x: 1, y: 1 }, radius: 0.098 }, // #10 close → plunge
    { kind: "circle", center: { x: 3, y: 1 }, radius: 0.5 }, // bore → pocket
  ];

  it("classifies plunges, pockets and contours", () => {
    const result = generateGcode(plate, OPTS);
    expect(result.stats).toMatchObject({ plunges: 1, pockets: 1, contours: 1 });
    expect(result.stats.passes).toBe(3); // 0.26 total at 0.1 DoC
    expect(result.gcode).toContain("outer profile - offset outside");
  });

  it("round-trips through our own parser with correct geometry", () => {
    const { gcode } = generateGcode(plate, OPTS);
    const tp = parseGcode(gcode);
    expect(tp.inches).toBe(true);
    expect(tp.meta.toolDiameter).toBeCloseTo(0.125, 5);
    expect(tp.meta.spindleSpeeds).toEqual([18000]);
    expect(tp.meta.feeds).toEqual([20, 60]);
    // outer profile offset OUTSIDE the 4x2 plate by the tool radius
    expect(tp.boundingBox.min.x).toBeCloseTo(-0.0625, 3);
    expect(tp.boundingBox.max.x).toBeCloseTo(4.0625, 3);
    // full depth with breakthrough
    expect(tp.boundingBox.min.z).toBeCloseTo(-0.26, 3);
    expect(tp.meta.cutDepth).toBeCloseTo(0.26, 3);
  });

  it("pocket walls stay tool-radius inside the bore", () => {
    const { gcode } = generateGcode(
      [{ kind: "circle", center: { x: 0, y: 0 }, radius: 0.5 }],
      OPTS,
    );
    const tp = parseGcode(gcode);
    // wall pass radius = 0.5 - 0.0625
    expect(tp.boundingBox.max.x).toBeCloseTo(0.4375, 3);
    expect(tp.boundingBox.min.x).toBeCloseTo(-0.4375, 3);
  });

  it("warns on open contours and cuts them on the line", () => {
    const result = generateGcode(
      [{ kind: "line", a: { x: 0, y: 0 }, b: { x: 2, y: 0 } }],
      OPTS,
    );
    expect(result.warnings.some((w) => w.includes("Open contour"))).toBe(true);
    expect(result.stats.contours).toBe(1);
  });
});
