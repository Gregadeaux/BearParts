/**
 * Transport-agnostic print runner. A transport only knows connect / write /
 * disconnect (chunking + per-chunk pacing live inside it); the per-command
 * pauses the M110 firmware needs come from the job segments.
 */
import type { JobSegment } from "./m110";

export type PrinterFault = "paper-out" | "cover-open";

export interface LabelTransport {
  /** Must be called straight from a click: it opens the browser's device chooser. */
  connect(): Promise<void>;
  /** Sends bytes in order, split into transport-sized chunks. */
  write(bytes: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
  /** Latest fault the printer reported, if the transport can hear it (BLE notify). */
  fault?(): PrinterFault | null;
}

export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** phomymo waits 500 ms between copies; no source shows an on-printer copies command. */
export const COPY_GAP_MS = 500;
export const MAX_COPIES = 20;

/** A failure worth showing as-is (its message is user-facing copy). */
export class LabelPrinterError extends Error {}

/**
 * The user closed the browser's device chooser without picking anything.
 * Chrome also uses NotFoundError for "Bluetooth adapter not available" — not a cancel.
 */
export function isChooserCancel(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const { name, message } = e as { name?: unknown; message?: unknown };
  return name === "NotFoundError" && !/adapter/i.test(String(message ?? ""));
}

export class PrinterFaultError extends Error {
  constructor(readonly fault: PrinterFault) {
    super(fault === "paper-out" ? "Out of labels" : "Printer cover is open");
  }
}

/**
 * `1a <type> <value>` notifications (phomymo parseNotificationFrame):
 * type 06 value 88 = paper out, type 05 value 98 / 99 = cover open / closed.
 * Returns the fault, null when the frame clears one, undefined if unrelated.
 */
export function parseStatus(frame: Uint8Array): PrinterFault | null | undefined {
  if (frame.length < 3 || frame[0] !== 0x1a) return undefined;
  if (frame[1] === 0x06) return frame[2] === 0x88 ? "paper-out" : null;
  if (frame[1] === 0x05) return frame[2] === 0x98 ? "cover-open" : frame[2] === 0x99 ? null : undefined;
  return undefined;
}

export interface PrintProgress {
  copy: number;
  copies: number;
}

/**
 * Connect, send the job `copies` times, disconnect — always, even on failure.
 * `connect()` runs synchronously first so the chooser keeps the click's user activation.
 */
export async function printJob(
  transport: LabelTransport,
  job: JobSegment[],
  opts: { copies?: number; sleep?: Sleep; onConnected?: () => void; onCopy?: (p: PrintProgress) => void } = {},
): Promise<void> {
  const copies = opts.copies ?? 1;
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) {
    throw new RangeError(`copies must be 1–${MAX_COPIES}`);
  }
  const sleep = opts.sleep ?? realSleep;
  const connecting = transport.connect();
  try {
    await connecting;
    opts.onConnected?.();
    for (let copy = 1; copy <= copies; copy++) {
      opts.onCopy?.({ copy, copies });
      for (const seg of job) {
        throwIfFault(transport);
        await transport.write(seg.bytes);
        if (seg.pauseAfterMs > 0) await sleep(seg.pauseAfterMs);
      }
      throwIfFault(transport);
      if (copy < copies) await sleep(COPY_GAP_MS);
    }
  } finally {
    // a failed disconnect after a good print is not worth reporting
    await transport.disconnect().catch(() => {});
  }
}

function throwIfFault(t: LabelTransport) {
  const f = t.fault?.();
  if (f) throw new PrinterFaultError(f);
}

/** `bytes` as `size`-byte copies (own buffers: some stacks send the whole underlying buffer). */
export function chunks(bytes: Uint8Array, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.slice(i, i + size));
  return out;
}
