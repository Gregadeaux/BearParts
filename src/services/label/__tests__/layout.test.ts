import { describe, expect, it } from "vitest";
import { qrMatrix, QR_QUIET_MODULES } from "@/services/drawing/qr";
import { drawLabel, renderLabel, type LabelContext } from "../draw";
import { layoutLabel, TEXT_MARGIN, wrap, type LabelLayout, type MeasureText } from "../layout";
import { getDot, rgbaToRaster } from "../raster";

const URL = "https://bearparts.fly.dev/parts/15e51973-cd2f-47df-92e5-a3f674cc2aa4";
const LIB_URL = "https://bearparts.fly.dev/library/parts/15e51973-cd2f-47df-92e5-a3f674cc2aa4";
const SIZE = { widthMm: 40, heightMm: 30 };

/** Deterministic stand-in for canvas text metrics: bold glyphs a bit wider. */
const measure: MeasureText = (text, px, bold) => text.length * px * (bold ? 0.62 : 0.55);

/** Canvas fake: real pixels for fillRect, measured-only text. */
function softContext(w: number, h: number): LabelContext & { texts: string[] } {
  const px = new Uint8ClampedArray(w * h * 4);
  const ctx = {
    fillStyle: "#000" as unknown,
    font: "10px sans-serif",
    textBaseline: "alphabetic",
    texts: [] as string[],
    fillRect(x: number, y: number, rw: number, rh: number) {
      const v = ctx.fillStyle === "#fff" ? 255 : 0;
      for (let yy = y; yy < y + rh; yy++) {
        for (let xx = x; xx < x + rw; xx++) {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const i = (yy * w + xx) * 4;
          px[i] = px[i + 1] = px[i + 2] = v;
          px[i + 3] = 255;
        }
      }
    },
    fillText(text: string) {
      ctx.texts.push(text);
    },
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
      return { width: measure(text, size, ctx.font.startsWith("bold")) };
    },
    getImageData: () => ({ data: px }),
  };
  return ctx;
}

const lineBottom = (l: LabelLayout["lines"][number]) => l.y + Math.round(l.fontPx * 1.15);

/** Every line inside the text margins and clear of the QR square (quiet zone included). */
function expectInside(layout: LabelLayout) {
  const qr = layout.qr;
  for (const l of layout.lines) {
    const right = l.x + measure(l.text, l.fontPx, l.bold);
    const bottom = lineBottom(l);
    expect(l.x).toBeGreaterThanOrEqual(TEXT_MARGIN);
    expect(l.y).toBeGreaterThanOrEqual(TEXT_MARGIN);
    expect(right).toBeLessThanOrEqual(layout.widthDots - TEXT_MARGIN);
    expect(bottom).toBeLessThanOrEqual(layout.heightDots - TEXT_MARGIN);
    if (qr) {
      const overlaps = l.x < qr.x + qr.sizeDots && right > qr.x && l.y < qr.y + qr.sizeDots && bottom > qr.y;
      expect(overlaps, `"${l.text}" overlaps the QR`).toBe(false);
    }
  }
}

describe("label layout (40 × 30 mm)", () => {
  const content = { title: "Shooter side plate", material: "6061 Al 1/8\"", qty: 4, url: URL };

  it("fits the label at 8 dots/mm with a whole-dot QR and full quiet zone", () => {
    const layout = layoutLabel(content, SIZE, measure);
    expect([layout.widthDots, layout.heightDots]).toEqual([320, 240]);
    const qr = layout.qr!;
    const n = qrMatrix(URL).length;
    expect(Number.isInteger(qr.modulePx)).toBe(true);
    expect(qr.modulePx).toBeGreaterThanOrEqual(4); // ≥ 0.5 mm modules
    expect(qr.sizeDots).toBe(qr.modulePx * (n + 2 * QR_QUIET_MODULES));
    expect(qr.x).toBeGreaterThanOrEqual(0);
    expect(qr.y).toBeGreaterThanOrEqual(0);
    expect(qr.y + qr.sizeDots).toBeLessThanOrEqual(240);
    expectInside(layout);
  });

  it("prints title, material, qty in that order; title bold on top, the rest along the bottom", () => {
    const layout = layoutLabel(content, SIZE, measure);
    // the 124-dot text column fits "Shooter" whole at 28 px — no split words
    expect(layout.lines.map((l) => l.text).join(" | ")).toBe('Shooter | side | plate | 6061 Al 1/8" | Qty 4');
    expect(layout.lines[0].fontPx).toBe(28);
    expect(layout.lines[0].bold).toBe(true);
    expect(layout.lines[0].y).toBe(TEXT_MARGIN);
    expect(lineBottom(layout.lines.at(-1)!)).toBe(240 - TEXT_MARGIN);
  });

  it("omits missing material and qty; a lone title is centered", () => {
    const layout = layoutLabel({ title: "Gusset", url: LIB_URL }, SIZE, measure);
    expect(layout.lines.map((l) => l.text)).toEqual(["Gusset"]);
    const l = layout.lines[0];
    expect(Math.abs(l.y + (lineBottom(l) - l.y) / 2 - 120)).toBeLessThanOrEqual(2);
    expect(layoutLabel({ ...content, qty: 0, material: "  " }, SIZE, measure).lines.map((x) => x.text)).toEqual([
      "Shooter",
      "side",
      "plate",
    ]);
  });

  it("shrinks and wraps long titles, then truncates with an ellipsis instead of overflowing", () => {
    const title = "Elevator second stage carriage outer side plate left hand mirrored revision B";
    const titleLines = (t: string) => {
      const layout = layoutLabel({ ...content, title: t }, SIZE, measure);
      expectInside(layout);
      return layout.lines.filter((l) => l.bold && !l.text.startsWith("Qty"));
    };
    const long = titleLines(title);
    expect(long.length).toBeGreaterThan(3);
    expect(long[0].fontPx).toBeLessThan(28);
    expect(long.some((l) => l.text.includes("…"))).toBe(false);
    expect(long.map((l) => l.text).join(" ")).toBe(title);

    const huge = titleLines(`${title} ${title} ${title}`);
    expect(huge[0].fontPx).toBe(16);
    expect(huge.at(-1)!.text.endsWith("…")).toBe(true);
  });

  it("breaks a single unspaced word and ellipsizes a long material", () => {
    const layout = layoutLabel(
      { title: "X".repeat(80), material: "Polycarbonate sheet, clear, 0.093 in, protective film both sides", qty: 12, url: URL },
      SIZE,
      measure,
    );
    expectInside(layout);
    expect(layout.lines.find((l) => !l.bold)!.text.endsWith("…")).toBe(true);
    expect(wrap("ABCDEFGHIJ", 3 * 10 * 0.62, 10, measure)).toEqual(["ABC", "DEF", "GHI", "J"]);
  });

  it("caps 50 mm labels at the 48 mm head, stacks tall labels, and refuses tiny ones", () => {
    expect(layoutLabel(content, { widthMm: 50, heightMm: 30 }, measure).widthDots).toBe(384);
    const tall = layoutLabel(content, { widthMm: 30, heightMm: 50 }, measure);
    expect(tall.qr!.y).toBeLessThan(tall.lines[0].y);
    expectInside(tall);
    expect(() => layoutLabel(content, { widthMm: 12, heightMm: 8 }, measure)).toThrow(/too small/);
    expect(layoutLabel({ ...content, url: null }, SIZE, measure).qr).toBeNull();
  });
});

describe("drawing the label to the 1-bit raster", () => {
  it("reproduces every QR module as a solid whole-dot block with a clear quiet zone", () => {
    const layout = layoutLabel({ title: "Bracket", qty: 2, url: URL }, SIZE, measure);
    const ctx = softContext(layout.widthDots, layout.heightDots);
    drawLabel(ctx, layout);
    const r = rgbaToRaster(ctx.getImageData(0, 0, 320, 240).data, 320, 240);
    const { matrix, x, y, modulePx: m } = layout.qr!;
    const total = matrix.length + 2 * QR_QUIET_MODULES;
    for (let mr = 0; mr < total; mr++) {
      for (let mc = 0; mc < total; mc++) {
        const r0 = mr - QR_QUIET_MODULES;
        const c0 = mc - QR_QUIET_MODULES;
        const dark = r0 >= 0 && c0 >= 0 && r0 < matrix.length && c0 < matrix.length && matrix[r0][c0];
        for (let dy = 0; dy < m; dy++) {
          for (let dx = 0; dx < m; dx++) expect(getDot(r, x + mc * m + dx, y + mr * m + dy)).toBe(dark);
        }
      }
    }
    expect(ctx.texts).toEqual(["Bracket", "Qty 2"]);
  });

  it("renders label + head rasters that agree bit for bit at the offset", () => {
    const out = renderLabel({ title: "Bracket", material: "PLA", qty: 1, url: URL }, SIZE, softContext, "center");
    expect([out.label.widthDots, out.head.widthDots, out.head.bytesPerRow, out.offsetDots]).toEqual([320, 384, 48, 32]);
    for (let yy = 0; yy < 240; yy += 7) {
      for (let xx = 0; xx < 320; xx++) expect(getDot(out.head, xx + 32, yy)).toBe(getDot(out.label, xx, yy));
    }
  });
});
