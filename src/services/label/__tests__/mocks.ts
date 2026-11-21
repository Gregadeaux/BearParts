/** Fake Web Bluetooth / WebUSB stacks that record every call, for transport tests. */
import type {
  BleCharacteristicLike,
  BleRequestOptions,
  BluetoothLike,
  UsbDeviceLike,
  UsbInterfaceLike,
} from "../web-devices";

const domError = (name: string, message = name) => Object.assign(new Error(message), { name });

export const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

export interface BleMockOptions {
  props?: { write: boolean; writeWithoutResponse: boolean };
  /** writes with this index (0-based, counting attempts) throw */
  failWrite?: (attempt: number, method: "noResponse" | "withResponse") => boolean;
  /** frame pushed on the notify characteristic after this many successful writes */
  notifyAfter?: { writes: number; frame: number[] };
  cancelChooser?: boolean;
}

export function mockBluetooth(opts: BleMockOptions = {}) {
  const log: string[] = [];
  const writes: { method: "noResponse" | "withResponse"; bytes: Uint8Array }[] = [];
  const requests: BleRequestOptions[] = [];
  let attempts = 0;
  let listener: ((e: Event) => void) | null = null;

  const record = (method: "noResponse" | "withResponse") => async (v: Uint8Array) => {
    if (opts.failWrite?.(attempts++, method)) throw domError("NetworkError", "GATT operation failed");
    writes.push({ method, bytes: new Uint8Array(v) });
    if (opts.notifyAfter && writes.length === opts.notifyAfter.writes && listener) {
      notifier.value = new DataView(new Uint8Array(opts.notifyAfter.frame).buffer);
      listener({ target: notifier } as unknown as Event);
    }
  };

  const writer: BleCharacteristicLike = {
    properties: opts.props ?? { write: true, writeWithoutResponse: true },
    writeValue: record("withResponse"),
    writeValueWithoutResponse: record("noResponse"),
    startNotifications: async () => undefined,
    stopNotifications: async () => undefined,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const notifier: BleCharacteristicLike = {
    properties: { write: false, writeWithoutResponse: false },
    value: null,
    writeValue: async () => {},
    writeValueWithoutResponse: async () => {},
    startNotifications: async () => log.push("startNotifications"),
    stopNotifications: async () => log.push("stopNotifications"),
    addEventListener: (_t, l) => {
      listener = l;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  const server = {
    connected: false,
    connect: async () => {
      log.push("gatt.connect");
      server.connected = true;
      return server;
    },
    disconnect: () => {
      log.push("gatt.disconnect");
      server.connected = false;
    },
    getPrimaryService: async (uuid: string) => {
      log.push(`service ${uuid}`);
      return {
        getCharacteristic: async (c: string) => {
          log.push(`characteristic ${c}`);
          if (c === "0000ff02-0000-1000-8000-00805f9b34fb") return writer;
          if (c === "0000ff03-0000-1000-8000-00805f9b34fb") return notifier;
          throw domError("NotFoundError");
        },
      };
    },
  };
  const bluetooth: BluetoothLike = {
    requestDevice: async (o) => {
      requests.push(o);
      log.push("requestDevice");
      if (opts.cancelChooser) throw domError("NotFoundError", "User cancelled the requestDevice() chooser.");
      return { name: "M110", gatt: server };
    },
  };
  return { bluetooth, server, writes, requests, log };
}

export interface UsbMockOptions {
  interfaces?: UsbInterfaceLike[];
  configured?: boolean;
  claimFails?: boolean;
  /** transfer with this index returns a stall */
  stallAt?: number;
}

/** A composite device like phomemo-tools' M02 dump: CDC control (0) + printer class (1). */
export const PRINTER_INTERFACES: UsbInterfaceLike[] = [
  {
    interfaceNumber: 0,
    alternates: [{ alternateSetting: 0, interfaceClass: 0x02, endpoints: [{ endpointNumber: 3, direction: "in", type: "interrupt" }] }],
  },
  {
    interfaceNumber: 1,
    alternates: [
      {
        alternateSetting: 0,
        interfaceClass: 0x07,
        endpoints: [
          { endpointNumber: 1, direction: "in", type: "bulk" },
          { endpointNumber: 2, direction: "out", type: "bulk" },
        ],
      },
    ],
  },
];

export function mockUsb(opts: UsbMockOptions = {}) {
  const log: string[] = [];
  const transfers: { endpoint: number; bytes: Uint8Array }[] = [];
  const filters: unknown[] = [];
  const config = { interfaces: opts.interfaces ?? PRINTER_INTERFACES };
  const device: UsbDeviceLike = {
    productName: "M110",
    opened: false,
    configuration: opts.configured ? config : null,
    open: async () => {
      log.push("open");
      device.opened = true;
    },
    close: async () => {
      log.push("close");
      device.opened = false;
    },
    selectConfiguration: async (v) => {
      log.push(`selectConfiguration ${v}`);
      device.configuration = config;
    },
    claimInterface: async (n) => {
      log.push(`claimInterface ${n}`);
      if (opts.claimFails) throw domError("NetworkError", "Unable to claim interface.");
    },
    releaseInterface: async (n) => {
      log.push(`releaseInterface ${n}`);
    },
    selectAlternateInterface: async (n, a) => {
      log.push(`selectAlternateInterface ${n} ${a}`);
    },
    transferOut: async (endpoint, data) => {
      if (transfers.length === opts.stallAt) return { status: "stall", bytesWritten: 0 };
      transfers.push({ endpoint, bytes: new Uint8Array(data) });
      return { status: "ok", bytesWritten: data.length };
    },
  };
  const usb = {
    requestDevice: async (o: { filters: unknown[] }) => {
      filters.push(...o.filters);
      log.push("requestDevice");
      return device;
    },
  };
  return { usb, device, transfers, filters, log };
}

/** A sleep that records its delays and resolves at once. */
export function fakeSleep() {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => void delays.push(ms) };
}
