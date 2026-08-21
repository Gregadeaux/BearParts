import { describe, expect, it } from "vitest";
import { analyzeDxfText } from "../../dxf/analysis.service";
import { faceExportToDxf, type FaceExportPlain } from "../face-export";
import { buildDxf } from "../dxf-builder";
import { fsToPlain } from "../fs-value";
import { mockDxfExport } from "../mock";

const IN = 0.0254; // meters per inch
type V3 = [number, number, number];

/** Plate face in a shifted plane: 2×1 in rect + Ø0.5 hole + right-side arc bump. */
function plateFace(): FaceExportPlain {
  const origin: V3 = [0.1, 0.2, 0.3];
  const p = (x: number, y: number): V3 => [origin[0] + x * IN, origin[1] + y * IN, origin[2]];
  const lineEdge = (a: [number, number], b: [number, number]) => ({
    kind: "line" as const,
    p0: p(...a),
    pm: p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
    p1: p(...b),
  });
  return {
    origin,
    xAxis: [1, 0, 0],
    normal: [0, 0, 1],
    edges: [
      lineEdge([0, 0], [2, 0]),
      lineEdge([2, 1], [0, 1]),
      lineEdge([0, 1], [0, 0]),
      // right edge broken by a semicircular bump from (2,0.25) to (2,0.75)
      lineEdge([2, 0], [2, 0.25]),
      {
        kind: "circle",
        p0: p(2, 0.25),
        pm: p(2.25, 0.5),
        p1: p(2, 0.75),
        center: p(2, 0.5),
        radius: 0.25 * IN,
      },
      lineEdge([2, 0.75], [2, 1]),
      // full-circle hole
      {
        kind: "circle",
        p0: p(1.25, 0.5),
        pm: p(0.75, 0.5),
        p1: p(1.25, 0.5),
        center: p(1, 0.5),
        radius: 0.25 * IN,
      },
    ],
  };
}

describe("faceExportToDxf", () => {
  it("projects edges to inches with the arc bump in the envelope", () => {
    const { dxf, envelope } = faceExportToDxf(plateFace());
    expect(envelope.width).toBeCloseTo(2.25, 4);
    expect(envelope.height).toBeCloseTo(1, 4);
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toContain("ARC");
    expect(dxf).toContain("$INSUNITS");
  });

  it("produces a DXF our analyzer reads back (units + bbox + hole)", () => {
    const { dxf } = faceExportToDxf(plateFace());
    const { analysis } = analyzeDxfText(dxf);
    expect(analysis.units).toBe("in");
    expect(analysis.boundingBox.width).toBeCloseTo(2.25, 3);
    expect(analysis.boundingBox.height).toBeCloseTo(1, 3);
    expect(analysis.holes.length).toBeGreaterThanOrEqual(1);
  });

  it("orients the arc CCW through its midpoint", () => {
    const { dxf } = faceExportToDxf(plateFace());
    // bump arc spans 270° → 90° (through 0°); shifted geometry keeps angles
    const lines = dxf.split("\r\n");
    const arcAt = lines.indexOf("ARC");
    expect(arcAt).toBeGreaterThan(-1);
    const startDeg = Number(lines[lines.indexOf("50", arcAt) + 1]);
    const endDeg = Number(lines[lines.indexOf("51", arcAt) + 1]);
    expect(startDeg).toBeCloseTo(270, 3);
    expect(endDeg).toBeCloseTo(90, 3);
  });

  it("tessellated (other) edges become polylines", () => {
    const face = plateFace();
    face.edges[0] = {
      kind: "other",
      p0: face.edges[0].p0,
      pm: face.edges[0].pm,
      p1: face.edges[0].p1,
      points: [face.edges[0].p0, face.edges[0].pm, face.edges[0].p1],
    };
    const { dxf } = faceExportToDxf(face);
    expect(dxf).toContain("LWPOLYLINE");
  });
});

describe("mockDxfExport", () => {
  it("round-trips through the analyzer at the advertised envelope", () => {
    const { dxf, envelope } = mockDxfExport("F1");
    const { analysis } = analyzeDxfText(dxf);
    expect(analysis.units).toBe("in");
    expect(analysis.boundingBox.width).toBeCloseTo(envelope.width, 2);
    expect(analysis.boundingBox.height).toBeCloseTo(envelope.height, 2);
    // 4 bolt holes + center bore
    expect(analysis.holes.length).toBe(5);
  });
});

describe("fsToPlain", () => {
  it("collapses maps, arrays and units to plain values", () => {
    const num = (v: number) => ({
      btType: "com.belmonttech.serialize.fsvalue.BTFSValueWithUnits-1817",
      value: v,
    });
    const str = (v: string) => ({
      btType: "com.belmonttech.serialize.fsvalue.BTFSValueString-1422",
      value: v,
    });
    const tree = {
      btType: "com.belmonttech.serialize.fsvalue.BTFSValueMap-2077",
      value: [
        { key: str("radius"), value: num(0.0254) },
        {
          key: str("center"),
          value: {
            btType: "com.belmonttech.serialize.fsvalue.BTFSValueArray-1499",
            value: [num(1), num(2), num(3)],
          },
        },
        { key: str("kind"), value: str("circle") },
      ],
    };
    expect(fsToPlain(tree)).toEqual({ radius: 0.0254, center: [1, 2, 3], kind: "circle" });
  });
});

describe("buildDxf", () => {
  it("writes mm units when asked", () => {
    const text = buildDxf([{ kind: "circle", cx: 0, cy: 0, r: 5 }], 4);
    expect(text).toContain("$INSUNITS");
    expect(text.split("\r\n")).toContain("4");
  });
});
