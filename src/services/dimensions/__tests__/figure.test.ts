import { describe, expect, it } from "vitest";
import type { BoundingBox } from "@/types/geometry";
import {
  arrowHead,
  extentDimensionLine,
  fitFigure,
  holeRingRadius,
  rotateBBox,
  rotatePoint,
  shouldRotate,
} from "../figure";
import { modelDimensionLine, modelFraming, modelView, viewExtents } from "../figure-3d";

const box = (x0: number, y0: number, x1: number, y1: number): BoundingBox => ({
  min: { x: x0, y: y0 },
  max: { x: x1, y: y1 },
  width: x1 - x0,
  height: y1 - y0,
});

describe("fitFigure", () => {
  it("fits the limiting extent inside the padding and centers the part", () => {
    const { viewBox, upp } = fitFigure(box(0, 0, 10, 2), { width: 340, height: 160 }, 20);
    expect(upp).toBeCloseTo(10 / 300); // width-limited
    const [x, y, w, h] = viewBox;
    expect(w).toBeCloseTo(340 * upp);
    expect(h).toBeCloseTo(160 * upp);
    expect(x + w / 2).toBeCloseTo(5);
    expect(-(y + h / 2)).toBeCloseTo(1); // flipped-y center
  });

  it("is height-limited for tall parts", () => {
    const { upp } = fitFigure(box(0, 0, 1, 10), { width: 340, height: 160 }, 20);
    expect(upp).toBeCloseTo(10 / 120);
  });
});

describe("extentDimensionLine", () => {
  const b = box(1, 2, 5, 4);

  it("x runs under the part, spanning exactly its width", () => {
    const d = extentDimensionLine(b, "x", 0.5, 0.1);
    expect(d.a).toEqual({ x: 1, y: 1.5 });
    expect(d.b).toEqual({ x: 5, y: 1.5 });
    expect(d.extA).toEqual([{ x: 1, y: 2 }, { x: 1, y: 1.4 }]);
    expect(d.mid).toEqual({ x: 3, y: 1.5 });
    expect(d.vertical).toBe(false);
  });

  it("y runs down the left side, spanning exactly its height", () => {
    const d = extentDimensionLine(b, "y", 0.5, 0.1);
    expect(d.a).toEqual({ x: 0.5, y: 2 });
    expect(d.b).toEqual({ x: 0.5, y: 4 });
    expect(d.extB).toEqual([{ x: 1, y: 4 }, { x: 0.4, y: 4 }]);
    expect(d.vertical).toBe(true);
  });
});

describe("quarter-turn for tall profiles", () => {
  it("only rotates a tall part into a wide figure", () => {
    expect(shouldRotate(box(0, 0, 4, 7), { width: 340, height: 144 })).toBe(true);
    expect(shouldRotate(box(0, 0, 7, 4), { width: 340, height: 144 })).toBe(false);
    expect(shouldRotate(box(0, 0, 4, 7), { width: 144, height: 340 })).toBe(false);
    expect(shouldRotate(box(0, 0, 4, 4.2), { width: 340, height: 144 })).toBe(false); // near-square stays put
  });

  it("rotates points and boxes consistently (box of rotated corners = rotated box)", () => {
    const b = box(1, 2, 5, 9);
    const r = rotateBBox(b);
    expect(r).toEqual({ min: { x: -9, y: 1 }, max: { x: -2, y: 5 }, width: 7, height: 4 });
    for (const corner of [b.min, b.max, { x: b.min.x, y: b.max.y }, { x: b.max.x, y: b.min.y }]) {
      const p = rotatePoint(corner);
      expect(p.x).toBeGreaterThanOrEqual(r.min.x);
      expect(p.x).toBeLessThanOrEqual(r.max.x);
      expect(p.y).toBeGreaterThanOrEqual(r.min.y);
      expect(p.y).toBeLessThanOrEqual(r.max.y);
    }
  });
});

describe("arrowHead", () => {
  it("puts the tip on the end and the base back along the line", () => {
    const [tip, l, r] = arrowHead({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, 1);
    expect(tip).toEqual({ x: 10, y: 0 });
    expect(l.x).toBeCloseTo(8);
    expect(r.x).toBeCloseTo(8);
    expect(Math.abs(l.y)).toBeCloseTo(1);
    expect(l.y).toBeCloseTo(-r.y);
  });
});

describe("holeRingRadius", () => {
  it("never shrinks below the on-screen minimum", () => {
    expect(holeRingRadius(0.01, 0.05, 7)).toBeCloseTo(0.35);
    expect(holeRingRadius(1, 0.001, 7)).toBeCloseTo(0.627);
  });
});

describe("modelView", () => {
  const plate = { x: 10, y: 4, z: 0.25 };

  it("measuring the length of a plate looks down at its face, length horizontal", () => {
    const v = modelView(plate, "x");
    expect(v).toMatchObject({ side: "z", horizontal: "x", up: "y", dimOnScreen: "horizontal" });
    expect(v.cameraDir[2]).toBeGreaterThan(0.8); // from above
  });

  it("measuring the width keeps the long side horizontal and the width vertical", () => {
    expect(modelView(plate, "y")).toMatchObject({ side: "z", horizontal: "x", up: "y", dimOnScreen: "vertical" });
  });

  it("measuring the thickness looks at the edge from the front", () => {
    const v = modelView(plate, "z");
    expect(v).toMatchObject({ side: "y", horizontal: "x", up: "z", dimOnScreen: "vertical" });
    expect(v.cameraDir[1]).toBeLessThan(-0.8); // from the front (−y)
  });

  it("camera direction is a unit vector", () => {
    const [x, y, z] = modelView({ x: 1, y: 2, z: 3 }, "y").cameraDir;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });

  it("the measured axis is never skewed on screen (true length, exactly horizontal/vertical)", () => {
    const cross = (a: number[], b: number[]) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const size of [plate, { x: 1, y: 2, z: 3 }, { x: 5, y: 5, z: 1 }]) {
      for (const axis of ["x", "y", "z"] as const) {
        const v = modelView(size, axis);
        const along = [0, 0, 0];
        along[["x", "y", "z"].indexOf(axis)] = 1;
        // same frame three's lookAt builds: right = up × back, screenUp = back × right
        const right = cross(v.upVec, v.cameraDir);
        const screenUp = cross(v.cameraDir, right);
        expect(dot(along, v.cameraDir)).toBeCloseTo(0); // parallel to the screen
        const off = v.dimOnScreen === "horizontal" ? dot(along, screenUp) : dot(along, right);
        expect(off).toBeCloseTo(0); // no roll
      }
    }
  });
});

describe("modelDimensionLine", () => {
  it("spans the full extent along the axis, below the model, on the camera-facing face", () => {
    const size = { x: 10, y: 4, z: 0.25 };
    const d = modelDimensionLine(size, "x", modelView(size, "x"), 1, 0.2);
    expect(d.a).toEqual([-5, -3, 0.125]);
    expect(d.b).toEqual([5, -3, 0.125]);
    expect(d.extA).toEqual([[-5, -2, 0.125], [-5, -3.2, 0.125]]);
    expect(d.mid).toEqual([0, -3, 0.125]);
  });

  it("close-ups can run the extension lines in to visible material", () => {
    const size = { x: 10, y: 4, z: 0.25 };
    const d = modelDimensionLine(size, "z", modelView(size, "z"), 1, 0.2, -3);
    expect(d.extA[0]).toEqual([-3, -2, -0.125]);
    expect(d.a).toEqual([-6, -2, -0.125]); // the line itself doesn't move
  });

  it("vertical dimensions sit left of the model", () => {
    const size = { x: 10, y: 4, z: 0.25 };
    const d = modelDimensionLine(size, "z", modelView(size, "z"), 1, 0.2);
    expect(d.a).toEqual([-6, -2, -0.125]);
    expect(d.b).toEqual([-6, -2, 0.125]);
  });
});

describe("modelFraming", () => {
  const px = { width: 430, height: 200 };

  it("fits the whole part when the dimension reads fine", () => {
    const size = { x: 10, y: 4, z: 2 };
    const f = modelFraming(size, "x", modelView(size, "x"), px, 30);
    expect(f.closeUp).toBe(false);
    expect(f.target).toEqual([0, 0, 0]);
    expect(size.x * f.zoom).toBeLessThanOrEqual(px.width - 60 + 1e-9);
  });

  it("zooms onto one end when a thin plate's thickness would be a sliver", () => {
    const plate = { x: 29, y: 9, z: 0.125 };
    const view = modelView(plate, "z");
    const f = modelFraming(plate, "z", view, px, 30);
    expect(f.closeUp).toBe(true);
    expect(plate.z * f.zoom).toBeCloseTo((px.height - 60) * 0.5); // thickness fills half the height
    // looking at the left end (where the dimension line is), on the camera-facing face
    expect(f.target[0]).toBeLessThan(0);
    expect(f.target[0]).toBeGreaterThan(-plate.x / 2);
    expect(f.target[1]).toBeCloseTo(-plate.y / 2);
  });
});

describe("viewExtents", () => {
  it("keeps the measured extent true length and projects the turned one, plus margins", () => {
    const size = { x: 10, y: 4, z: 0.25 };
    const deg = Math.PI / 180;
    const along = viewExtents(size, modelView(size, "x"), 1); // horizontal dimension
    expect(along.width).toBeCloseTo(12);
    expect(along.height).toBeCloseTo(4 * Math.cos(20 * deg) + 0.25 * Math.sin(20 * deg) + 2);
    const across = viewExtents(size, modelView(size, "y"), 1); // vertical dimension
    expect(across.height).toBeCloseTo(6);
    expect(across.width).toBeCloseTo(10 * Math.cos(20 * deg) + 0.25 * Math.sin(20 * deg) + 2);
  });
});
