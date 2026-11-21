"use client";

import { useState } from "react";
import { Download, LoaderCircle, RulerDimensionLine } from "lucide-react";
import { toast } from "sonner";
import type { DrawingSource } from "@/types/drawing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadDrawing } from "./download-drawing";

interface Props {
  source: DrawingSource;
  size?: "sm" | "default";
}

/** Confirm title-block details, then build and download the drawing PDF. */
export function DrawingDialog({ source, size = "sm" }: Props) {
  const isDxf = source.fileType === "dxf";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thickness, setThickness] = useState("");
  const [material, setMaterial] = useState("");
  const [drafter, setDrafter] = useState("");

  const thicknessIn = thickness.trim() === "" ? null : Number(thickness);
  const thicknessBad = thicknessIn !== null && !(thicknessIn > 0 && thicknessIn < 12);

  const reset = () => {
    setThickness(source.thicknessIn ? String(source.thicknessIn) : "");
    setMaterial(source.material ?? "");
    setDrafter(source.drafter ?? "");
  };

  const generate = async () => {
    setBusy(true);
    try {
      await downloadDrawing(source, {
        thicknessIn: isDxf ? thicknessIn : source.thicknessIn,
        material,
        drafter,
      });
      toast.success("Drawing downloaded");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the drawing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        if (v) reset();
        setOpen(v);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size={size} nativeButton />}>
        <RulerDimensionLine /> Drawing
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Dimensioned drawing</DialogTitle>
          <DialogDescription>
            {isDxf ? "Flat profile, ANSI A, inches." : "Front, top, right + isometric, ANSI A, inches."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && !thicknessBad) void generate();
          }}
        >
          {isDxf && (
            <div className="space-y-1.5">
              <Label htmlFor="drawing-thk">Thickness (in)</Label>
              <Input
                id="drawing-thk"
                inputMode="decimal"
                placeholder="0.125"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                aria-invalid={thicknessBad}
              />
              <p className="text-xs text-muted-foreground">
                {thicknessBad ? "Enter inches, e.g. 0.125" : thicknessIn === null ? "Blank prints “not specified”" : null}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="drawing-material">Material</Label>
            <Input
              id="drawing-material"
              placeholder="1/8 5052 aluminum"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drawing-drafter">Drawn by</Label>
            <Input id="drawing-drafter" value={drafter} onChange={(e) => setDrafter(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || thicknessBad}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
            {busy ? "Generating…" : "Download PDF"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
