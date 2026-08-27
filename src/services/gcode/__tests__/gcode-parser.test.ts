import { describe, expect, it } from "vitest";
import { parseGcode } from "../gcode-parser";

describe("parseGcode", () => {
  it("parses linear moves with modal G1", () => {
    const tp = parseGcode(`
      G20 G90
      G0 X0 Y0 Z0.5
      G1 Z-0.1 F10
      X1
      Y1
    `);
    expect(tp.inches).toBe(true);
    expect(tp.segments).toHaveLength(4);
    expect(tp.segments[0].rapid).toBe(true);
    expect(tp.segments[1].rapid).toBe(false);
    // modal G1 carries to the bare X/Y lines
    expect(tp.segments[3].to).toEqual([1, 1, -0.1]);
  });

  it("handles relative mode", () => {
    const tp = parseGcode(`G91\nG1 X1\nX1\n`);
    expect(tp.segments[1].to[0]).toBeCloseTo(2);
  });

  it("interpolates IJ arcs", () => {
    // full quarter circle: (1,0) -> (0,1) around (0,0), CCW
    const tp = parseGcode(`G90\nG0 X1 Y0\nG3 X0 Y1 I-1 J0\n`);
    const arcSegs = tp.segments.filter((s) => !s.rapid);
    expect(arcSegs.length).toBeGreaterThan(5);
    const last = arcSegs[arcSegs.length - 1];
    expect(last.to[0]).toBeCloseTo(0, 3);
    expect(last.to[1]).toBeCloseTo(1, 3);
    // every interpolated point stays on the unit circle
    for (const seg of arcSegs) {
      expect(Math.hypot(seg.to[0], seg.to[1])).toBeCloseTo(1, 3);
    }
  });

  it("extracts feed, spindle and depth metadata", () => {
    const tp = parseGcode(`
      G20 G90
      S18000 M3
      G0 X0 Y0 Z0.5
      G1 Z-0.09 F30
      G1 X2 F100
      G1 Y1
      G1 Z-0.18 F30
      G1 X0 F100
      G1 Z-0.26 F30
      G1 Y0 F100
      G0 Z0.5
    `);
    expect(tp.meta.spindleSpeeds).toEqual([18000]);
    expect(tp.meta.feeds).toEqual([30, 100]);
    expect(tp.meta.cutLevels).toEqual([-0.09, -0.18, -0.26]);
    expect(tp.meta.cutDepth).toBeCloseTo(0.26, 5);
    // step-downs are 0.09, 0.08 — not uniform enough to report
    expect(tp.meta.stepdown).toBeNull();
  });

  it("reports a uniform step-down", () => {
    const tp = parseGcode(`
      G20 G90
      G0 Z0.5
      G1 Z-0.1 F30
      G1 X1 F80
      G1 Z-0.2
      G1 X0
      G1 Z-0.3
      G1 X1
    `);
    expect(tp.meta.cutLevels).toEqual([-0.1, -0.2, -0.3]);
    expect(tp.meta.stepdown).toBeCloseTo(0.1, 5);
    expect(tp.meta.cutDepth).toBeCloseTo(0.3, 5);
  });

  it("plunges alone produce no pass levels", () => {
    const tp = parseGcode(`G90\nG0 X0 Y0 Z1\nG1 Z-0.5 F10\n`);
    expect(tp.meta.cutLevels).toEqual([]);
    expect(tp.meta.cutDepth).toBeNull();
    expect(tp.meta.feeds).toEqual([10]);
  });

  it("strips comments", () => {
    const tp = parseGcode(`(header comment)\nG1 X5 ; move over\n`);
    expect(tp.segments).toHaveLength(1);
    expect(tp.segments[0].to[0]).toBe(5);
  });

  it("computes the bounding box", () => {
    const tp = parseGcode(`G0 X0 Y0\nG1 X2 Y3 Z-1\n`);
    expect(tp.boundingBox.size).toEqual({ x: 2, y: 3, z: 1 });
  });

  it("rejects files without moves", () => {
    expect(() => parseGcode("G20\nG90\nM3 S10000\n")).toThrow();
  });
});
