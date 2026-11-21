/**
 * The slices of Web Bluetooth and WebUSB the transports use. TypeScript's DOM
 * lib has neither, and keeping them structural lets tests pass plain mocks.
 */

export interface BleRequestOptions {
  filters: ({ services?: string[]; namePrefix?: string })[];
  optionalServices: string[];
}

export interface BluetoothLike {
  requestDevice(options: BleRequestOptions): Promise<BleDeviceLike>;
}

export interface BleDeviceLike {
  name?: string;
  gatt?: BleServerLike;
}

export interface BleServerLike {
  connected: boolean;
  connect(): Promise<BleServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleServiceLike>;
}

export interface BleServiceLike {
  getCharacteristic(uuid: string): Promise<BleCharacteristicLike>;
}

export interface BleCharacteristicLike {
  properties: { write: boolean; writeWithoutResponse: boolean };
  value?: DataView | null;
  writeValue(value: Uint8Array): Promise<void>;
  writeValueWithoutResponse(value: Uint8Array): Promise<void>;
  startNotifications(): Promise<unknown>;
  stopNotifications(): Promise<unknown>;
  addEventListener(type: "characteristicvaluechanged", listener: (e: Event) => void): void;
  removeEventListener(type: "characteristicvaluechanged", listener: (e: Event) => void): void;
}

export interface UsbFilter {
  vendorId: number;
  productId?: number;
}

export interface UsbLike {
  requestDevice(options: { filters: UsbFilter[] }): Promise<UsbDeviceLike>;
}

export interface UsbEndpointLike {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
}

export interface UsbAlternateLike {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: UsbEndpointLike[];
}

export interface UsbInterfaceLike {
  interfaceNumber: number;
  alternates: UsbAlternateLike[];
}

export interface UsbDeviceLike {
  productName?: string;
  opened: boolean;
  configuration: { interfaces: UsbInterfaceLike[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  selectAlternateInterface(n: number, alt: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<{ status: string; bytesWritten: number }>;
}

/** What this browser can do, read once from `navigator` / `window`. */
export interface PrintSupport {
  secure: boolean;
  bluetooth: BluetoothLike | null;
  usb: UsbLike | null;
}

export function detectSupport(): PrintSupport {
  if (typeof window === "undefined") return { secure: false, bluetooth: null, usb: null };
  const nav = navigator as Navigator & { bluetooth?: BluetoothLike; usb?: UsbLike };
  return { secure: window.isSecureContext, bluetooth: nav.bluetooth ?? null, usb: nav.usb ?? null };
}
