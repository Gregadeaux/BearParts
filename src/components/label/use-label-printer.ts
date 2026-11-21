"use client";

import { useState } from "react";
import { BleTransport } from "@/services/label/ble";
import { encodeJob } from "@/services/label/m110";
import type { Raster } from "@/services/label/raster";
import {
  isChooserCancel,
  LabelPrinterError,
  PrinterFaultError,
  printJob,
  type LabelTransport,
} from "@/services/label/transport";
import { UsbTransport } from "@/services/label/usb";
import type { PrintSupport } from "@/services/label/web-devices";
import type { LabelLink } from "./label-prefs";

export type PrintPhase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "printing"; copy: number; copies: number }
  | { kind: "done"; copies: number }
  | { kind: "error"; message: string };

function transportFor(link: LabelLink, support: PrintSupport): LabelTransport | null {
  if (link === "ble" && support.bluetooth) return new BleTransport(support.bluetooth);
  if (link === "usb" && support.usb) return new UsbTransport(support.usb);
  return null;
}

function messageFor(e: unknown, link: LabelLink): string {
  if (e instanceof LabelPrinterError || e instanceof PrinterFaultError) return e.message;
  const name = typeof e === "object" && e !== null ? (e as { name?: string }).name : undefined;
  if (name === "SecurityError") return link === "usb" ? "USB access was blocked" : "Bluetooth access was blocked";
  if (name === "NotFoundError" || name === "NotSupportedError" || name === "NotAllowedError") {
    return link === "ble" ? "Bluetooth is off or unavailable" : "USB is unavailable here";
  }
  if (name === "NetworkError") return "Lost the printer mid-job. Check it and try again.";
  return "Print failed. Check the printer and try again.";
}

/**
 * Print state machine. `print` must run straight from the click handler — it
 * opens the browser's device chooser before awaiting anything.
 */
export function useLabelPrinter() {
  const [phase, setPhase] = useState<PrintPhase>({ kind: "idle" });

  const print = (raster: Raster, link: LabelLink, copies: number, support: PrintSupport) => {
    const transport = transportFor(link, support);
    if (!transport) {
      setPhase({ kind: "error", message: link === "ble" ? "No Bluetooth in this browser" : "No USB in this browser" });
      return;
    }
    const job = encodeJob(raster);
    const run = printJob(transport, job, {
      copies,
      onCopy: ({ copy }) => setPhase({ kind: "printing", copy, copies }),
    });
    setPhase({ kind: "connecting" });
    run.then(
      () => setPhase({ kind: "done", copies }),
      (e: unknown) =>
        setPhase(isChooserCancel(e) ? { kind: "idle" } : { kind: "error", message: messageFor(e, link) }),
    );
  };

  const busy = phase.kind === "connecting" || phase.kind === "printing";
  return { phase, busy, print, reset: () => setPhase({ kind: "idle" }) };
}

export type LabelPrinter = ReturnType<typeof useLabelPrinter>;
