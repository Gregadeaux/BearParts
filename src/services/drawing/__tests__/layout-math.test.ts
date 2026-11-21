import { describe, expect, it } from "vitest";
import { dedupeValues, maxDisplacement, pickScale, spreadLabels } from "../layout-math";
import { countPrefix, drawingFileName, fmtIn, fmtOrdinate, fmtScale, fmtTol, isoDate } from "../format";
import { centerDashes } from "../dims";
import { DIA, textBox, textWidth } from "../text-metrics";
import { text, pt } from "../primitives";

describe("drafting number formats", () => {
  it("uses three decimals and drops the leading zero below one inch", () => {
    expect(fmtIn(0.25)).toBe(".250");
    expect(fmtIn(1.5)).toBe("1.500");
    expect(fmtIn(0.2005)).toBe(".201");
    expect(fmtIn(12)).toBe("12.000");
  });
  it("prints the ordinate datum as a bare 0", () => {
    expect(fmtOrdinate(0)).toBe("0");
    expect(fmtOrdinate(0.0001)).toBe("0");
    expect(fmtOrdinate(0.375)).toBe(".375");
  });
  it("formats tolerances, scales, counts, dates and file names", () => {
    expect(fmtTol(0.01)).toBe("±.010");
    expect(fmtTol(0.005)).toBe("±.005");
    expect(fmtScale(1)).toBe("1:1");
    expect(fmtScale(2)).toBe("2:1");
    expect(fmtScale(0.25)).toBe("1:4");
    expect(countPrefix(1)).toBe("");
    expect(countPrefix(4)).toBe("4X ");
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(drawingFileName('Arm "v2" plate')).toBe("Arm v2 plate - drawing.pdf");
  });
});

describe("pickScale", () => {
  it("picks the largest standard scale that fits", () => {
    expect(pickScale(2, 1, 8, 5)).toBe(2);
    expect(pickScale(6, 3, 7, 4)).toBe(1);
    expect(pickScale(9, 5, 7, 4)).toBe(0.5);
    expect(pickScale(30, 20, 7, 4)).toBe(0.125);
  });
});

describe("ordinate helpers", () => {
  it("dedupes values within tolerance, ascending", () => {
    expect(dedupeValues([1.5, 0.3749, 0.3751, 0, 1.5])).toEqual([0, 0.3749, 1.5]);
  });

  it("leaves well-spaced labels alone", () => {
    expect(spreadLabels([0, 1, 2], 0.2)).toEqual([0, 1, 2]);
  });

  it("spreads crowded labels symmetrically to the minimum gap", () => {
    const placed = spreadLabels([1, 1.05, 1.1], 0.2)!;
    expect(placed[1] - placed[0]).toBeCloseTo(0.2);
    expect(placed[2] - placed[1]).toBeCloseTo(0.2);
    expect(placed[1]).toBeCloseTo(1.05); // centered on the cluster
    expect(maxDisplacement([1, 1.05, 1.1], placed)).toBeCloseTo(0.15);
  });

  it("keeps labels inside the range and keeps order", () => {
    const placed = spreadLabels([0, 0.01, 0.02, 5], 0.2, 0, 5)!;
    expect(placed[0]).toBeGreaterThanOrEqual(0);
    expect(placed[3]).toBeLessThanOrEqual(5);
    for (let i = 1; i < placed.length; i++) expect(placed[i] - placed[i - 1]).toBeGreaterThanOrEqual(0.2 - 1e-9);
  });

  it("returns null when labels cannot fit", () => {
    expect(spreadLabels([0, 0.1, 0.2, 0.3], 0.5, 0, 1)).toBeNull();
  });
});

describe("symbols and text metrics", () => {
  it("reserves width for the vector diameter symbol", () => {
    expect(textWidth(`${DIA}.201`, 0.12)).toBeGreaterThan(textWidth(".201", 0.12));
  });
  it("boxes rotated ordinate text along the y axis", () => {
    const b = textBox(text("1.500", pt(1, 1), 0.12, { rotate: 90, align: "right", valign: "middle" }));
    expect(b.y1).toBeCloseTo(1);
    expect(b.x1 - b.x0).toBeCloseTo(0.12);
    expect(b.y1 - b.y0).toBeCloseTo(textWidth("1.500", 0.12));
  });
  it("center lines end on long dashes and cover the span", () => {
    const d = centerDashes(0.125, 2.5);
    expect(d[0][0]).toBeCloseTo(0.125);
    expect(d[d.length - 1][1]).toBeCloseTo(2.5);
    const longs = d.filter(([a, b]) => b - a > 0.3);
    expect(longs.length).toBeGreaterThanOrEqual(2);
  });
});
