"use client";

import { useMemo, useState } from "react";
import { Bluetooth, Check, LoaderCircle, Printer, Usb } from "lucide-react";
import { HEAD_PLACEMENT, LABEL_SIZES, labelSize } from "@/services/label/config";
import { browserContext, renderLabel, type LabelPrint } from "@/services/label/draw";
import type { LabelContent } from "@/services/label/layout";
import { detectSupport } from "@/services/label/web-devices";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CopiesStepper } from "./copies-stepper";
import { LabelPreview } from "./label-preview";
import { loadLabelPrefs, saveLabelPrefs, type LabelLink, type LabelPrefs } from "./label-prefs";
import type { LabelPrinter, PrintPhase } from "./use-label-printer";

const LINKS: { value: LabelLink; label: string; Icon: typeof Bluetooth }[] = [
  { value: "ble", label: "Bluetooth", Icon: Bluetooth },
  { value: "usb", label: "USB", Icon: Usb },
];

/** Mounted only while the dialog is open (client only), so it may read navigator + storage. */
export function LabelDialogBody({ content, printer }: { content: LabelContent; printer: LabelPrinter }) {
  const [support] = useState(detectSupport);
  const [prefs, setPrefs] = useState(loadLabelPrefs);
  const [copies, setCopies] = useState(1);
  const { title, material, qty, url } = content;

  const rendered = useMemo((): { print: LabelPrint } | { error: string } => {
    try {
      return { print: renderLabel({ title, material, qty, url }, labelSize(prefs.size), browserContext, HEAD_PLACEMENT) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't draw the label" };
    }
  }, [title, material, qty, url, prefs.size]);

  const available = { ble: Boolean(support.bluetooth), usb: Boolean(support.usb) };
  const link: LabelLink = available[prefs.link] ? prefs.link : available.ble ? "ble" : "usb";
  const canPrint = support.secure && (available.ble || available.usb);
  const update = (patch: Partial<LabelPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveLabelPrefs(next);
    printer.reset();
  };

  return (
    <div className="space-y-3">
      {"print" in rendered ? (
        <LabelPreview print={rendered.print} label={`Label preview: ${title}`} />
      ) : (
        <p className="py-6 text-center text-sm text-destructive">{rendered.error}</p>
      )}

      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label>Label</Label>
          <Select
            value={prefs.size}
            onValueChange={(v) => v && update({ size: v as LabelPrefs["size"] })}
            items={LABEL_SIZES.map((s) => ({ value: s.value, label: s.label }))}
          >
            <SelectTrigger className="w-full" disabled={printer.busy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABEL_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canPrint && <CopiesStepper value={copies} onChange={setCopies} disabled={printer.busy} />}
      </div>

      {canPrint ? (
        <>
          <div role="group" aria-label="Connection" className="grid grid-cols-2 gap-2">
            {LINKS.map(({ value, label, Icon }) => (
              <Button
                key={value}
                type="button"
                variant={link === value ? "secondary" : "outline"}
                aria-pressed={link === value}
                disabled={!available[value] || printer.busy}
                className={cn(link === value && "ring-1 ring-foreground/20")}
                onClick={() => update({ link: value })}
              >
                <Icon /> {label}
              </Button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={printer.busy || !("print" in rendered)}
            onClick={() => "print" in rendered && printer.print(rendered.print.head, link, copies, support)}
          >
            {printer.busy ? <LoaderCircle className="animate-spin" /> : <Printer />}
            {printer.busy ? "Printing…" : copies > 1 ? `Print ${copies}` : "Print"}
          </Button>
          <PhaseLine phase={printer.phase} />
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {support.secure
            ? "Printing needs Chrome or Edge on Android or a computer."
            : "Printing needs a secure (https) page."}
        </p>
      )}
    </div>
  );
}

function PhaseLine({ phase }: { phase: PrintPhase }) {
  const text =
    phase.kind === "connecting"
      ? "Connecting…"
      : phase.kind === "printing"
        ? phase.copies > 1
          ? `Printing ${phase.copy} of ${phase.copies}…`
          : "Printing…"
        : phase.kind === "done"
          ? phase.copies > 1
            ? `Printed ${phase.copies}`
            : "Printed"
          : phase.kind === "error"
            ? phase.message
            : null;
  if (!text) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-center justify-center gap-1.5 text-center text-sm",
        phase.kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {phase.kind === "done" && <Check className="size-4" />}
      {text}
    </p>
  );
}
