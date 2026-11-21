import { describe, expect, it } from "vitest";
import { encodeJob, FOOTER, jobBytes, M110, rasterHeader } from "../m110";
import { blankRaster, getDot, placeOnHead, rasterToRgba, rgbaToRaster, setDot } from "../raster";

/** RGBA for a w×h image with the listed dots black, rest white. */
function image(w: number, h: number, black: [number, number][]) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y] of black) px.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3);
  return px;
}

const hex = (b: Uint8Array) => [...b].map((v) => v.toString(16).padStart(2, "0")).join(" ");

describe("M110 job encoder", () => {
  it("encodes a tiny raster to the exact bytes", () => {
    // 10 × 2 dots: row 0 has the first and last dot, row 1 dots 1–8
    const r = rgbaToRaster(
      image(10, 2, [
        [0, 0],
        [9, 0],
        ...Array.from({ length: 8 }, (_, i) => [i + 1, 1] as [number, number]),
      ]),
      10,
      2,
    );
    const job = encodeJob(r);
    expect(job.map((s) => s.kind)).toEqual(["speed", "density", "media", "header", "bitmap", "footer"]);
    expect(hex(jobBytes(job))).toBe(
      [
        "1b 4e 0d 05", // speed 5
        "1b 4e 04 0a", // density 10
        "1f 11 0a", // media: label with gaps
        "1d 76 30 00 02 00 02 00", // GS v 0, mode 0, 2 bytes/row, 2 rows (LE16)
        "80 40", // row 0: MSB = leftmost dot, set = black; dot 9 → 2nd byte bit 6
        "7f 80", // row 1: dots 1–8
        "1f f0 05 00 1f f0 03 00", // footer
      ].join(" "),
    );
  });

  it("carries speed, density and media options", () => {
    const job = encodeJob(blankRaster(8, 1), { speed: 3, density: 15, media: "continuous" });
    expect(hex(job[0].bytes)).toBe("1b 4e 0d 03");
    expect(hex(job[1].bytes)).toBe("1b 4e 04 0f");
    expect(hex(job[2].bytes)).toBe("1f 11 0b");
    expect(hex(encodeJob(blankRaster(8, 1), { media: "marks" })[2].bytes)).toBe("1f 11 26");
  });

  it("paces like the working BLE flows: 30 ms after each setting, 300 / 500 ms around the footer", () => {
    expect(encodeJob(blankRaster(8, 1)).map((s) => s.pauseAfterMs)).toEqual([30, 30, 30, 0, 300, 500]);
  });

  it("rejects out-of-range settings and mismatched data", () => {
    expect(() => encodeJob(blankRaster(8, 1), { density: 16 })).toThrow(RangeError);
    expect(() => encodeJob(blankRaster(8, 1), { speed: 0 })).toThrow(RangeError);
    expect(() => encodeJob({ widthDots: 8, heightDots: 2, bytesPerRow: 1, data: new Uint8Array(1) })).toThrow();
    expect(() => rasterHeader(48, 0)).toThrow(RangeError);
  });

  it("pads a 40 × 30 mm label to the 384-dot head, centered", () => {
    const label = blankRaster(40 * M110.dotsPerMm, 30 * M110.dotsPerMm);
    expect([label.widthDots, label.heightDots, label.bytesPerRow]).toEqual([320, 240, 40]);
    setDot(label, 0, 0);
    setDot(label, 319, 239);
    const { raster: head, offsetDots } = placeOnHead(label, M110.headDots, "center");
    expect(offsetDots).toBe(32);
    expect([head.bytesPerRow, head.heightDots, head.data.length]).toEqual([48, 240, 48 * 240]);
    expect(head.data[4]).toBe(0x80); // label dot 0 → head dot 32
    expect(head.data[239 * 48 + 43]).toBe(0x01); // label dot 319 → head dot 351
    for (let y = 0; y < 240; y++) {
      for (const b of [0, 1, 2, 3, 44, 45, 46, 47]) expect(head.data[y * 48 + b]).toBe(0);
    }
    const job = encodeJob(head);
    expect(hex(job[3].bytes)).toBe("1d 76 30 00 30 00 f0 00"); // 48 bytes × 240 rows
    expect(job[4].bytes.length).toBe(11520);
    expect(jobBytes(job).length).toBe(4 + 4 + 3 + 8 + 11520 + FOOTER.length);
  });
});

describe("raster conversion", () => {
  it("thresholds luminance, MSB first, transparency is paper", () => {
    const px = new Uint8ClampedArray([
      0, 0, 0, 255, // black
      127, 127, 127, 255, // just under mid-grey
      128, 128, 128, 255, // at threshold → white
      0, 0, 0, 0, // transparent black → white
    ]);
    const r = rgbaToRaster(px, 4, 1);
    expect([0, 1, 2, 3].map((x) => getDot(r, x, 0))).toEqual([true, true, false, false]);
    expect(r.data[0]).toBe(0b1100_0000);
    expect(getDot(rgbaToRaster(px, 4, 1, 200), 2, 0)).toBe(true);
  });

  it("places left, right, or not at all", () => {
    const label = blankRaster(20, 1);
    setDot(label, 0, 0);
    expect(placeOnHead(label, 32, "left").offsetDots).toBe(0);
    const right = placeOnHead(label, 32, "right");
    expect(right.offsetDots).toBe(12);
    expect(getDot(right.raster, 12, 0)).toBe(true);
    expect(placeOnHead(label, 32, "none").raster).toBe(label);
    expect(() => placeOnHead(blankRaster(40, 1), 32, "center")).toThrow(RangeError);
  });

  it("previews a window of the raster as black-on-white pixels", () => {
    const r = blankRaster(16, 1);
    setDot(r, 9, 0);
    const px = rasterToRgba(r, 8, 4); // dots 8–11
    expect([px[0], px[4], px[8], px[12]]).toEqual([255, 0, 255, 255]);
    expect(px[7]).toBe(255);
  });
});
