"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import type { LabelContent } from "@/services/label/layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LabelDialogBody } from "./label-dialog-body";
import { useLabelPrinter } from "./use-label-printer";

/**
 * "Label": preview and print a QR part label on a Phomemo M110 over Bluetooth
 * or USB. Not destructive, so every role gets it.
 */
export function PrintLabelButton({
  content,
  size = "sm",
}: {
  content: LabelContent;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const printer = useLabelPrinter();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (printer.busy) return;
        if (!v) printer.reset();
        setOpen(v);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size={size} nativeButton />}>
        <Tag /> Label
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Print label</DialogTitle>
          <DialogDescription>Phomemo M110 · QR to this part</DialogDescription>
        </DialogHeader>
        {open && <LabelDialogBody content={content} printer={printer} />}
      </DialogContent>
    </Dialog>
  );
}
