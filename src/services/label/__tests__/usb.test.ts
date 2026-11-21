import { describe, expect, it } from "vitest";
import { encodeJob, jobBytes, M110 } from "../m110";
import { blankRaster, placeOnHead, setDot } from "../raster";
import { LabelPrinterError, printJob } from "../transport";
import { pickInterface, USB, UsbTransport } from "../usb";
import { concat, fakeSleep, mockUsb, PRINTER_INTERFACES } from "./mocks";

function job40x30() {
  const label = blankRaster(320, 240);
  for (let i = 0; i < 240; i++) setDot(label, (i * 11) % 320, i);
  return encodeJob(placeOnHead(label, M110.headDots, "center").raster);
}

describe("WebUSB transport", () => {
  it("opens, configures, claims the printer interface and streams to its bulk OUT endpoint", async () => {
    const m = mockUsb();
    const { sleep, delays } = fakeSleep();
    const job = job40x30();
    await printJob(new UsbTransport(m.usb, { sleep }), job, { sleep });

    expect(m.filters).toContainEqual({ vendorId: 0x0493, productId: 0x8760 });
    expect(m.log.slice(0, 4)).toEqual(["requestDevice", "open", "selectConfiguration 1", "claimInterface 1"]);
    expect(m.transfers.every((t) => t.endpoint === 2)).toBe(true);
    expect(Math.max(...m.transfers.map((t) => t.bytes.length))).toBeLessThanOrEqual(USB.chunkBytes);
    expect(concat(m.transfers.map((t) => t.bytes))).toEqual(jobBytes(job));
    expect(m.transfers).toHaveLength(4 + Math.ceil(11520 / 512) + 1);
    expect(delays.filter((d) => d !== USB.chunkDelayMs)).toEqual([30, 30, 30, 300, 500]);
    expect(m.log.slice(-2)).toEqual(["releaseInterface 1", "close"]);
    expect(m.device.opened).toBe(false);
  });

  it("skips selectConfiguration when the device is already configured; copies repeat the job", async () => {
    const m = mockUsb({ configured: true });
    const job = job40x30();
    await printJob(new UsbTransport(m.usb, fakeSleep()), job, { copies: 2, ...fakeSleep() });
    expect(m.log).not.toContain("selectConfiguration 1");
    const one = jobBytes(job);
    expect(concat(m.transfers.map((t) => t.bytes))).toEqual(concat([one, one]));
  });

  it("explains a driver-owned device (Windows) and still closes it", async () => {
    const m = mockUsb({ claimFails: true });
    const err = await printJob(new UsbTransport(m.usb, fakeSleep()), job40x30(), fakeSleep()).catch((e) => e);
    expect(err).toBeInstanceOf(LabelPrinterError);
    expect(err.message).toMatch(/Windows.*Bluetooth/);
    expect(m.transfers).toHaveLength(0);
    expect(m.log.at(-1)).toBe("close");
  });

  it("fails on a stalled transfer, releasing and closing", async () => {
    const m = mockUsb({ stallAt: 6 });
    const run = printJob(new UsbTransport(m.usb, fakeSleep()), job40x30(), fakeSleep());
    await expect(run).rejects.toThrow("USB write failed (stall)");
    expect(m.transfers).toHaveLength(6);
    expect(m.log.slice(-2)).toEqual(["releaseInterface 1", "close"]);
  });

  it("prefers the printer-class interface, falls back to CDC data, needs a bulk OUT", () => {
    const device = (interfaces = PRINTER_INTERFACES) => mockUsb({ interfaces, configured: true }).device;
    expect(pickInterface(device())).toMatchObject({ interfaceNumber: 1, endpoint: 2 });
    const cdc = [
      PRINTER_INTERFACES[0],
      {
        interfaceNumber: 1,
        alternates: [
          {
            alternateSetting: 0,
            interfaceClass: 0x0a,
            endpoints: [{ endpointNumber: 5, direction: "out" as const, type: "bulk" as const }],
          },
        ],
      },
    ];
    expect(pickInterface(device(cdc))).toMatchObject({ interfaceNumber: 1, endpoint: 5 });
    expect(pickInterface(device([PRINTER_INTERFACES[0]]))).toBeNull();
  });
});
