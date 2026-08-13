import { describe, expect, it } from "vitest";
import { snapToFeature } from "../snap.service";
import { analyzeDxfText } from "../analysis.service";
import { circle, dxf, rect } from "./fixtures";

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
