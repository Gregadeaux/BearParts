"use client";

import { useState } from "react";
import { FlaskConical, Download } from "lucide-react";
import type { NormalizedEntity } from "@/types/geometry";
import {
  generateGcode,
  type GcodeGenOptions,
  type GcodeGenResult,
} from "@/services/gcode/gcode-generator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GcodeWorkspace } from "./gcode-workspace";

const DEFAULTS: GcodeGenOptions = {
  toolDiameter: 0.125,
  feed: 60,
  plungeFeed: 20,
  spindleRpm: 18000,
  passDepth: 0.08,
  thickness: 0.25,
  safeZ: 0.25,
  pocketThreshold: 0.3,
};

const FIELDS: { key: keyof GcodeGenOptions; label: string; step: number }[] = [
  { key: "toolDiameter", label: "Tool Ø (in)", step: 0.001 },
  { key: "feed", label: "Feed (IPM)", step: 5 },
  { key: "plungeFeed", label: "Plunge (IPM)", step: 5 },
  { key: "spindleRpm", label: "Spindle (RPM)", step: 500 },
  { key: "passDepth", label: "DoC / pass (in)", step: 0.01 },
  { key: "thickness", label: "Thickness (in)", step: 0.005 },
  { key: "safeZ", label: "Safe Z (in)", step: 0.05 },
  { key: "pocketThreshold", label: "Pocket holes ≥ Ø (in)", step: 0.05 },
];

interface Props {
  entities: NormalizedEntity[];
  /** download file base name */
  baseName?: string;
}

/**
 * EXPERIMENTAL (temporary): one-endmill CAM for DXF parts. Plunges fastener
 * holes, pockets bores, offsets contours — outputs an .nc you can preview
 * with the animated toolpath viewer before downloading.
 */
export function GenerateGcodeDialog({ entities, baseName = "part" }: Props) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<GcodeGenOptions>(DEFAULTS);
  const [result, setResult] = useState<GcodeGenResult | null>(null);

  const setField = (key: keyof GcodeGenOptions, raw: string) => {
    const value = Number(raw);
    if (Number.isFinite(value)) setOpts((o) => ({ ...o, [key]: value }));
    setResult(null); // inputs changed — stale program
  };

  const run = () => setResult(generateGcode(entities, opts));

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName.replace(/[\\/:*?"<>|]+/g, "")}.nc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" nativeButton />}>
        <FlaskConical /> Generate G-code
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Generate G-code <Badge variant="secondary">experimental</Badge>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          One-endmill CAM: fastener holes are plunged at tool size, bores are
          pocketed, contours are tool-radius offset (outer outside, cutouts
          inside). No tabs — catch your parts.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                step={f.step}
                value={opts[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={run}>Generate</Button>
          {result && (
            <Button variant="outline" onClick={download}>
              <Download /> Download .nc
            </Button>
          )}
          {result && (
            <span className="text-xs text-muted-foreground">
              {result.stats.plunges} plunges · {result.stats.pockets} pockets ·{" "}
              {result.stats.contours} contours · {result.stats.passes} passes
            </span>
          )}
        </div>

        {result && result.warnings.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {result && <GcodeWorkspace gcodeText={result.gcode} />}
      </DialogContent>
    </Dialog>
  );
}
