import { describe, expect, it } from "vitest";
import { encodeJob } from "../m110";
import { blankRaster } from "../raster";
import { chunks, parseStatus, printJob, type LabelTransport } from "../transport";
import { fakeSleep } from "./mocks";

function recorder(failOn?: number) {
  const log: string[] = [];
  const written: number[][] = [];
  const t: LabelTransport = {
    connect: async () => void log.push("connect"),
    write: async (b) => {
      if (written.length === failOn) throw new Error("boom");
      written.push([...b]);
    },
    disconnect: async () => void log.push("disconnect"),
  };
  return { t, log, written };
}

const job = encodeJob(blankRaster(16, 2));

describe("printJob", () => {
  it("writes segments in order, once per copy, and disconnects", async () => {
    const r = recorder();
    await printJob(r.t, job, { copies: 2, ...fakeSleep() });
    expect(r.written).toEqual([...job, ...job].map((s) => [...s.bytes]));
    expect(r.log).toEqual(["connect", "disconnect"]);
  });

  it("reports progress per copy", async () => {
    const seen: string[] = [];
    await printJob(recorder().t, job, { copies: 3, ...fakeSleep(), onCopy: (p) => seen.push(`${p.copy}/${p.copies}`) });
    expect(seen).toEqual(["1/3", "2/3", "3/3"]);
  });

  it("disconnects after a failed write", async () => {
    const r = recorder(2);
    await expect(printJob(r.t, job, fakeSleep())).rejects.toThrow("boom");
    expect(r.log).toEqual(["connect", "disconnect"]);
  });

  it("rejects bad copy counts before touching the printer", async () => {
    for (const copies of [0, 21, 1.5]) {
      const r = recorder();
      await expect(printJob(r.t, job, { copies, ...fakeSleep() })).rejects.toThrow(RangeError);
      expect(r.log).toEqual([]);
    }
  });
});

describe("status frames", () => {
  it("reads paper and cover state, ignores the rest", () => {
    expect(parseStatus(new Uint8Array([0x1a, 0x06, 0x88]))).toBe("paper-out");
    expect(parseStatus(new Uint8Array([0x1a, 0x06, 0x89]))).toBeNull();
    expect(parseStatus(new Uint8Array([0x1a, 0x05, 0x98]))).toBe("cover-open");
    expect(parseStatus(new Uint8Array([0x1a, 0x05, 0x99]))).toBeNull();
    expect(parseStatus(new Uint8Array([0x1a, 0x04, 0xa2]))).toBeUndefined(); // battery
    expect(parseStatus(new Uint8Array([0x01, 0x01]))).toBeUndefined();
  });
});

describe("chunks", () => {
  it("splits into own-buffer slices that rejoin exactly", () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);
    const parts = chunks(bytes, 128);
    expect(parts.map((p) => p.length)).toEqual([128, 128, 44]);
    expect(parts.every((p) => p.buffer.byteLength === p.length)).toBe(true);
    expect(parts.flatMap((p) => [...p])).toEqual([...bytes]);
  });
});
