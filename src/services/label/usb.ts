/**
 * WebUSB transport. IDs: 0493:8760 is the M110 in phomemo-tools'
 * cups/backend/phomemo.py (printer class 7); phomymo www/usb.js lists
 * 0483:5740 (an STM32 virtual-COM ID). Bytes go to the first bulk OUT endpoint
 * of the printer-class interface, 512 at a time, 20 ms apart (phomymo usb.js).
 *
 * Where the OS has bound its own driver to the printer (Windows usbprint,
 * Linux usblp) the browser can't claim it; that surfaces as a clear error.
 */
import { chunks, LabelPrinterError, realSleep, type LabelTransport, type Sleep } from "./transport";
import type { UsbAlternateLike, UsbDeviceLike, UsbFilter, UsbLike } from "./web-devices";

export const USB = {
  printerClass: 0x07,
  cdcDataClass: 0x0a,
  vendorClass: 0xff,
  chunkBytes: 512,
  chunkDelayMs: 20,
} as const;

export const USB_FILTERS: UsbFilter[] = [
  { vendorId: 0x0493, productId: 0x8760 },
  { vendorId: 0x0493 },
  { vendorId: 0x0483, productId: 0x5740 },
];

const CLAIM_HELP = "Can't open the printer over USB — the system's printer driver has it (always on Windows). Use Bluetooth.";

interface Pick {
  interfaceNumber: number;
  alternate: UsbAlternateLike;
  endpoint: number;
}

/** Printer-class interface first, then CDC-data / vendor ones; each needs a bulk OUT. */
export function pickInterface(device: UsbDeviceLike): Pick | null {
  const interfaces = device.configuration?.interfaces ?? [];
  for (const cls of [USB.printerClass, USB.cdcDataClass, USB.vendorClass]) {
    for (const iface of interfaces) {
      for (const alternate of iface.alternates) {
        if (alternate.interfaceClass !== cls) continue;
        const out = alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
        if (out) return { interfaceNumber: iface.interfaceNumber, alternate, endpoint: out.endpointNumber };
      }
    }
  }
  return null;
}

export class UsbTransport implements LabelTransport {
  private device: UsbDeviceLike | null = null;
  private claimed: number | null = null;
  private endpoint: number | null = null;
  private readonly sleep: Sleep;

  constructor(
    private readonly usb: UsbLike,
    opts: { sleep?: Sleep } = {},
  ) {
    this.sleep = opts.sleep ?? realSleep;
  }

  async connect(): Promise<void> {
    // first statement, no await before it: the chooser needs the click's activation
    const picking = this.usb.requestDevice({ filters: USB_FILTERS });
    const device = await picking;
    this.device = device;
    try {
      if (!device.opened) await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
    } catch {
      throw new LabelPrinterError(CLAIM_HELP);
    }
    const pick = pickInterface(device);
    if (!pick) throw new LabelPrinterError("No printer interface on that USB device");
    try {
      await device.claimInterface(pick.interfaceNumber);
    } catch {
      throw new LabelPrinterError(CLAIM_HELP);
    }
    this.claimed = pick.interfaceNumber;
    if (pick.alternate.alternateSetting !== 0) {
      await device.selectAlternateInterface(pick.interfaceNumber, pick.alternate.alternateSetting);
    }
    this.endpoint = pick.endpoint;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const device = this.device;
    const endpoint = this.endpoint;
    if (!device || endpoint === null) throw new LabelPrinterError("Not connected");
    for (const chunk of chunks(bytes, USB.chunkBytes)) {
      const result = await device.transferOut(endpoint, chunk);
      if (result.status !== "ok" || result.bytesWritten !== chunk.length) {
        throw new LabelPrinterError(`USB write failed (${result.status})`);
      }
      await this.sleep(USB.chunkDelayMs);
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.device = null;
    this.endpoint = null;
    if (!device) return;
    if (this.claimed !== null) await device.releaseInterface(this.claimed).catch(() => {});
    this.claimed = null;
    if (device.opened) await device.close().catch(() => {});
  }
}
