/**
 * Phomemo M110 (also M120/M220) wire protocol — pure, no browser APIs.
 *
 * Sources (reverse-engineered, never verified against hardware here):
 * - vivier/phomemo-tools cups/filter/rastertopm110.py + README §5 (USB capture
 *   of the official app): speed / density / media commands, GS v 0 raster, footer.
 * - transcriptionstream/phomymo (vendored in hakarune/phomymo-android
 *   www/printer.js printM110): the same bytes as discrete BLE writes with pauses.
 * - mkuhlmann/pyphomemo protocol.py / printer.py: same sequence, same pauses;
 *   "merging everything into one stream makes the printer flash and discard".
 */
import type { Raster } from "./raster";

export const M110 = {
  /** 203 dpi = 8 dots/mm (phomemo-m110.drv `*Resolution … 203dpi`). */
  dotsPerMm: 8,
  /** Print head width: 384 dots = 48 bytes = 48 mm. */
  headDots: 384,
} as const;

export type MediaType = "gaps" | "continuous" | "marks";

/** `1f 11 <media>` values (phomemo-m110.drv MediaType 10 / 11 / 38). */
const MEDIA_BYTE: Record<MediaType, number> = { gaps: 0x0a, continuous: 0x0b, marks: 0x26 };

export interface JobOptions {
  /** 1 (slow) … 5 (fast). Every source sends 5. */
  speed?: number;
  /** 1 (light) … 15 (dark). phomemo-tools' CUPS default is 10. */
  density?: number;
  media?: MediaType;
}

export const DEFAULT_JOB: Required<JobOptions> = { speed: 5, density: 10, media: "gaps" };

export type SegmentKind = "speed" | "density" | "media" | "header" | "bitmap" | "footer";

/**
 * One write group of a print job. The transport sends each segment as its own
 * write(s) and waits `pauseAfterMs` before the next — the firmware needs the gaps.
 */
export interface JobSegment {
  kind: SegmentKind;
  bytes: Uint8Array;
  pauseAfterMs: number;
}

/** Pauses from phomymo printM110 / pyphomemo DELAY_* (30 ms, 300 ms before footer, 500 ms after). */
const PAUSE: Record<SegmentKind, number> = {
  speed: 30,
  density: 30,
  media: 30,
  header: 0,
  bitmap: 300,
  footer: 500,
};

const ESC = 0x1b;
const GS = 0x1d;

const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];

function checkRange(name: string, v: number, lo: number, hi: number) {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new RangeError(`${name} must be ${lo}–${hi}, got ${v}`);
}

/** `GS v 0 m xL xH yL yH`: raster bit image, mode 0 (normal), 16-bit little-endian sizes. */
export function rasterHeader(bytesPerRow: number, rows: number): Uint8Array {
  checkRange("bytes per row", bytesPerRow, 1, 0xffff);
  checkRange("rows", rows, 1, 0xffff);
  return new Uint8Array([GS, 0x76, 0x30, 0x00, ...le16(bytesPerRow), ...le16(rows)]);
}

/** `1f f0 05 00 1f f0 03 00` — ends the job; the printer then feeds to the next gap. */
export const FOOTER = new Uint8Array([0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00]);

/**
 * The exact print job for one label. Row data is packed 1 bpp, MSB = leftmost
 * dot, bit set = black (rastertopm110.py inverts before packing; phomymo sets
 * the bit when luminance < 128), rows top to bottom, no compression.
 */
export function encodeJob(raster: Raster, options: JobOptions = {}): JobSegment[] {
  const { speed, density, media } = { ...DEFAULT_JOB, ...options };
  checkRange("speed", speed, 1, 5);
  checkRange("density", density, 1, 15);
  if (raster.data.length !== raster.bytesPerRow * raster.heightDots) {
    throw new RangeError("raster data does not match its size");
  }
  const seg = (kind: SegmentKind, bytes: Uint8Array): JobSegment => ({ kind, bytes, pauseAfterMs: PAUSE[kind] });
  return [
    seg("speed", new Uint8Array([ESC, 0x4e, 0x0d, speed])),
    seg("density", new Uint8Array([ESC, 0x4e, 0x04, density])),
    seg("media", new Uint8Array([0x1f, 0x11, MEDIA_BYTE[media]])),
    seg("header", rasterHeader(raster.bytesPerRow, raster.heightDots)),
    seg("bitmap", raster.data),
    seg("footer", FOOTER),
  ];
}

/** Every byte of a job in send order (what the printer receives, minus pacing). */
export function jobBytes(segments: JobSegment[]): Uint8Array {
  const out = new Uint8Array(segments.reduce((n, s) => n + s.bytes.length, 0));
  let at = 0;
  for (const s of segments) {
    out.set(s.bytes, at);
    at += s.bytes.length;
  }
  return out;
}
