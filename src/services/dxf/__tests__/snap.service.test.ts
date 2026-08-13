import { describe, expect, it } from "vitest";
import { curveAtPoint, snapToFeature } from "../snap.service";
import { analyzeDxfText } from "../analysis.service";
import { arc, circle, dxf, filletedRect, rect } from "./fixtures";

const TOL = 0.1;

function setup() {
  const text = dxf({
    insunits: 1,
    entities: [rect(0, 0, 6, 3), circle(1, 1, 0.196 / 2)],
  });
  const { entities, analysis } = analyzeDxfText(text);
  return { entities, holes: analysis.holes };
}

describe("snapToFeature", () => {
  it("snaps to a hole center when clicking near or inside it", () => {
    const { entities, holes } = setup();
    const snap = snapToFeature(entities, holes, { x: 1.05, y: 0.97 }, TOL);
    expect(snap.x).toBeCloseTo(1, 5);
    expect(snap.y).toBeCloseTo(1, 5);
    expect(snap.label).toBe('⌀0.196" hole');
  });

  it("snaps to the nearest corner", () => {
    const { entities, holes } = setup();
    const snap = snapToFeature(entities, holes, { x: 0.06, y: 2.93 }, TOL);
    expect(snap.x).toBeCloseTo(0, 5);
    expect(snap.y).toBeCloseTo(3, 5);
    expect(snap.label).toBe("corner");
  });

  it("keeps the raw point when nothing is close", () => {
    const { entities, holes } = setup();
    const snap = snapToFeature(entities, holes, { x: 3.5, y: 1.7 }, TOL);
    expect(snap.x).toBeCloseTo(3.5, 5);
    expect(snap.label).toBe("point");
  });

  it("prefers the hole over a nearby corner", () => {
    const text = dxf({ insunits: 1, entities: [rect(0, 0, 2, 2), circle(0.15, 0.15, 0.1)] });
    const { entities, analysis } = analyzeDxfText(text);
    const snap = snapToFeature(entities, analysis.holes, { x: 0.12, y: 0.12 }, TOL);
    expect(snap.label).toContain("hole");
  });
});

describe("curveAtPoint", () => {
  it("hits a standalone arc and reports its radius", () => {
    // quarter arc r=0.5 centered at (2,2), 0°→90°; mid-arc point is at 45°
    const text = dxf({ insunits: 1, entities: [arc(2, 2, 0.5, 0, 90)] });
    const { entities } = analyzeDxfText(text);
    const hit = curveAtPoint(entities, { x: 2.36, y: 2.36 }, 0.05);
    expect(hit).not.toBeNull();
    expect(hit!.radius).toBeCloseTo(0.5, 5);
    expect(hit!.center.x).toBeCloseTo(2, 5);
  });

  it("misses points off the arc's sweep even at the right radius", () => {
    const text = dxf({ insunits: 1, entities: [arc(2, 2, 0.5, 0, 90)] });
    const { entities } = analyzeDxfText(text);
    // (1.5, 2) is at 180° — right distance, wrong side
    expect(curveAtPoint(entities, { x: 1.5, y: 2 }, 0.05)).toBeNull();
  });

  it("hits polyline fillet bulges", () => {
    // filletedRect(0,0,2,1,0.25): first fillet center (1.75,0.25); mid at -45°
    const text = dxf({ insunits: 1, entities: [filletedRect(0, 0, 2, 1, 0.25)] });
    const { entities } = analyzeDxfText(text);
    const hit = curveAtPoint(entities, { x: 1.927, y: 0.073 }, 0.05);
    expect(hit).not.toBeNull();
    expect(hit!.radius).toBeCloseTo(0.25, 3);
  });

  it("returns null away from any curve", () => {
    const text = dxf({ insunits: 1, entities: [filletedRect(0, 0, 2, 1, 0.25)] });
    const { entities } = analyzeDxfText(text);
    expect(curveAtPoint(entities, { x: 1, y: 0.5 }, 0.05)).toBeNull();
  });
});
