/**
 * Web Bluetooth transport for the M110: service 0xFF00, write 0xFF02, notify
 * 0xFF03 (phomymo constants.js BLE; pyphomemo protocol.py). 128-byte writes
 * 20 ms apart, write-without-response when the characteristic offers it.
 */
import {
  chunks,
  LabelPrinterError,
  parseStatus,
  realSleep,
  type LabelTransport,
  type PrinterFault,
  type Sleep,
} from "./transport";
import type {
  BleCharacteristicLike,
  BleDeviceLike,
  BleRequestOptions,
  BleServiceLike,
  BluetoothLike,
} from "./web-devices";

const uuid16 = (n: number) => `0000${n.toString(16).padStart(4, "0")}-0000-1000-8000-00805f9b34fb`;

export const BLE = {
  service: uuid16(0xff00),
  write: uuid16(0xff02),
  notify: uuid16(0xff03),
  chunkBytes: 128,
  chunkDelayMs: 20,
} as const;

/**
 * Chooser filters (any one matches). M110s advertise "M110…" or a bare serial
 * starting "Q" (pyphomemo models.py; phomymo ble.js namePrefix list).
 */
export const BLE_REQUEST: BleRequestOptions = {
  filters: [
    { services: [BLE.service] },
    { namePrefix: "M110" },
    { namePrefix: "M120" },
    { namePrefix: "M220" },
    { namePrefix: "Q" },
    { namePrefix: "Mr.in" },
    { namePrefix: "Phomemo" },
  ],
  optionalServices: [BLE.service],
};

export class BleTransport implements LabelTransport {
  private device: BleDeviceLike | null = null;
  private writer: BleCharacteristicLike | null = null;
  private notifier: BleCharacteristicLike | null = null;
  private withResponse = false;
  private lastFault: PrinterFault | null = null;
  private readonly sleep: Sleep;

  constructor(
    private readonly bluetooth: BluetoothLike,
    opts: { sleep?: Sleep } = {},
  ) {
    this.sleep = opts.sleep ?? realSleep;
  }

  private onNotify = (e: Event) => {
    const value = (e.target as BleCharacteristicLike | null)?.value;
    if (!value) return;
    const f = parseStatus(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    if (f !== undefined) this.lastFault = f;
  };

  async connect(): Promise<void> {
    // first statement, no await before it: the chooser needs the click's activation
    const picking = this.bluetooth.requestDevice(BLE_REQUEST);
    this.device = await picking;
    const gatt = this.device.gatt;
    if (!gatt) throw new LabelPrinterError("This device has no Bluetooth LE services");
    let service: BleServiceLike;
    try {
      const server = await gatt.connect();
      service = await server.getPrimaryService(BLE.service);
    } catch {
      throw new LabelPrinterError("Couldn't connect. Is the printer on and in range?");
    }
    const writer = await service.getCharacteristic(BLE.write).catch(() => {
      throw new LabelPrinterError("That device isn't an M110 (no print characteristic)");
    });
    this.writer = writer;
    this.withResponse = !writer.properties.writeWithoutResponse && writer.properties.write;
    try {
      const notifier = await service.getCharacteristic(BLE.notify);
      notifier.addEventListener("characteristicvaluechanged", this.onNotify);
      await notifier.startNotifications();
      this.notifier = notifier;
    } catch {
      // status is a nicety; print without it
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    const ch = this.writer;
    if (!ch) throw new LabelPrinterError("Not connected");
    for (const chunk of chunks(bytes, BLE.chunkBytes)) {
      if (this.withResponse) {
        await ch.writeValue(chunk);
      } else {
        try {
          await ch.writeValueWithoutResponse(chunk);
        } catch {
          // some stacks reject no-response writes; phomymo falls back the same way
          this.withResponse = true;
          await ch.writeValue(chunk);
        }
      }
      await this.sleep(BLE.chunkDelayMs);
    }
  }

  fault(): PrinterFault | null {
    return this.lastFault;
  }

  async disconnect(): Promise<void> {
    const notifier = this.notifier;
    this.notifier = null;
    this.writer = null;
    if (notifier) {
      notifier.removeEventListener("characteristicvaluechanged", this.onNotify);
      await notifier.stopNotifications().catch(() => {});
    }
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.device = null;
  }
}
