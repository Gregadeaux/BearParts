import { describe, expect, it } from "vitest";
import { BLE, BleTransport } from "../ble";
import { encodeJob, jobBytes, M110 } from "../m110";
import { blankRaster, placeOnHead, setDot } from "../raster";
import { COPY_GAP_MS, isChooserCancel, PrinterFaultError, printJob } from "../transport";
import { concat, fakeSleep, mockBluetooth } from "./mocks";

const SERVICE = "0000ff00-0000-1000-8000-00805f9b34fb";
const WRITE = "0000ff02-0000-1000-8000-00805f9b34fb";
const NOTIFY = "0000ff03-0000-1000-8000-00805f9b34fb";

/** A 40 × 30 mm label on the head with a few dots so the bitmap isn't all zeros. */
function job40x30() {
  const label = blankRaster(320, 240);
  for (let i = 0; i < 240; i++) setDot(label, (i * 7) % 320, i);
  return encodeJob(placeOnHead(label, M110.headDots, "center").raster);
}

describe("Web Bluetooth transport", () => {
  it("asks for the M110 service, writes without response in ≤128-byte chunks, byte-exact, then disconnects", async () => {
    const bt = mockBluetooth();
    const { sleep, delays } = fakeSleep();
    const job = job40x30();
    await printJob(new BleTransport(bt.bluetooth, { sleep }), job, { sleep });

    expect(bt.requests).toHaveLength(1);
    expect(bt.requests[0].optionalServices).toEqual([SERVICE]);
    expect(bt.requests[0].filters).toContainEqual({ services: [SERVICE] });
    expect(bt.requests[0].filters).toContainEqual({ namePrefix: "M110" });
    expect(bt.log.slice(0, 6)).toEqual([
      "requestDevice",
      "gatt.connect",
      `service ${SERVICE}`,
      `characteristic ${WRITE}`,
      `characteristic ${NOTIFY}`,
      "startNotifications",
    ]);

    expect(bt.writes.every((w) => w.method === "noResponse")).toBe(true);
    expect(Math.max(...bt.writes.map((w) => w.bytes.length))).toBeLessThanOrEqual(BLE.chunkBytes);
    expect(concat(bt.writes.map((w) => w.bytes))).toEqual(jobBytes(job));
    // each command is its own write, in order: speed, density, media, raster header
    expect(bt.writes.slice(0, 4).map((w) => [...w.bytes])).toEqual(job.slice(0, 4).map((s) => [...s.bytes]));
    expect([...bt.writes.at(-1)!.bytes]).toEqual([...job.at(-1)!.bytes]);
    expect(bt.writes).toHaveLength(4 + Math.ceil(11520 / 128) + 1);

    // 20 ms after every chunk plus the firmware pauses between segments
    expect(delays.filter((d) => d === BLE.chunkDelayMs)).toHaveLength(bt.writes.length);
    expect(delays.filter((d) => d !== BLE.chunkDelayMs)).toEqual([30, 30, 30, 300, 500]);

    expect(bt.log.slice(-2)).toEqual(["stopNotifications", "gatt.disconnect"]);
    expect(bt.server.connected).toBe(false);
  });

  it("sends the whole job once per copy, 500 ms apart", async () => {
    const bt = mockBluetooth();
    const { sleep, delays } = fakeSleep();
    const job = job40x30();
    await printJob(new BleTransport(bt.bluetooth, { sleep }), job, { copies: 3, sleep });
    const one = jobBytes(job);
    expect(concat(bt.writes.map((w) => w.bytes))).toEqual(concat([one, one, one]));
    expect(delays.filter((d) => d === COPY_GAP_MS).length).toBe(2 + 3); // gaps + each footer's 500 ms
    expect(bt.log.filter((l) => l === "requestDevice")).toHaveLength(1);
  });

  it("uses write-with-response when the characteristic has no other", async () => {
    const bt = mockBluetooth({ props: { write: true, writeWithoutResponse: false } });
    const job = job40x30();
    await printJob(new BleTransport(bt.bluetooth, fakeSleep()), job, fakeSleep());
    expect(bt.writes.every((w) => w.method === "withResponse")).toBe(true);
    expect(concat(bt.writes.map((w) => w.bytes))).toEqual(jobBytes(job));
  });

  it("falls back to write-with-response if a no-response write is rejected, losing nothing", async () => {
    const bt = mockBluetooth({ failWrite: (n, m) => n === 5 && m === "noResponse" });
    const job = job40x30();
    await printJob(new BleTransport(bt.bluetooth, fakeSleep()), job, fakeSleep());
    expect(bt.writes[5].method).toBe("withResponse");
    expect(concat(bt.writes.map((w) => w.bytes))).toEqual(jobBytes(job));
  });

  it("disconnects when a write fails for good", async () => {
    const bt = mockBluetooth({ failWrite: (n) => n >= 10 });
    const run = printJob(new BleTransport(bt.bluetooth, fakeSleep()), job40x30(), fakeSleep());
    await expect(run).rejects.toThrow("GATT operation failed");
    expect(bt.log.at(-1)).toBe("gatt.disconnect");
    expect(bt.server.connected).toBe(false);
  });

  it("stops and reports paper-out from the notify characteristic", async () => {
    const bt = mockBluetooth({ notifyAfter: { writes: 3, frame: [0x1a, 0x06, 0x88] } });
    const run = printJob(new BleTransport(bt.bluetooth, fakeSleep()), job40x30(), fakeSleep());
    await expect(run).rejects.toEqual(new PrinterFaultError("paper-out"));
    expect(bt.writes).toHaveLength(3); // nothing after the fault
    expect(bt.server.connected).toBe(false);
  });

  it("treats a closed chooser as a cancel, never touching GATT", async () => {
    const bt = mockBluetooth({ cancelChooser: true });
    const err = await printJob(new BleTransport(bt.bluetooth, fakeSleep()), job40x30(), fakeSleep()).catch((e) => e);
    expect(isChooserCancel(err)).toBe(true);
    expect(bt.log).toEqual(["requestDevice"]);
    expect(isChooserCancel(Object.assign(new Error("Bluetooth adapter not available."), { name: "NotFoundError" }))).toBe(false);
  });

  it("opens the chooser synchronously, inside the click's user activation", () => {
    const bt = mockBluetooth();
    void printJob(new BleTransport(bt.bluetooth, fakeSleep()), job40x30(), fakeSleep());
    expect(bt.log).toEqual(["requestDevice"]); // before any microtask ran
  });
});
