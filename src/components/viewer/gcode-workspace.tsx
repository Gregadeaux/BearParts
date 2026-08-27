"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { parseGcode } from "@/services/gcode/gcode-parser";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const GcodeViewer = dynamic(() => import("./gcode-viewer").then((m) => m.GcodeViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[55svh] min-h-64 w-full lg:h-[60svh]" />,
});

/** Toolpath preview for a G-code file, with cut/rapid stats. */
export function GcodeWorkspace({ gcodeText }: { gcodeText: string }) {
  const result = useMemo(() => {
    try {
      return { toolpath: parseGcode(gcodeText), error: null };
    } catch (e) {
      return { toolpath: null, error: e instanceof Error ? e.message : "Could not read this file" };
    }
  }, [gcodeText]);

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        {result.error}
      </div>
    );
  }
  const tp = result.toolpath!;
  const { size } = tp.boundingBox;
  const unit = tp.inches ? '"' : " mm";
  const { meta } = tp;
  const feedUnit = tp.inches ? "IPM" : "mm/min";
  const fmt = (v: number) => String(Number(v.toFixed(tp.inches ? 3 : 2)));
  const range = (values: number[], suffix: string) =>
    values.length === 1
      ? `${fmt(values[0])} ${suffix}`
      : `${fmt(values[0])}–${fmt(values[values.length - 1])} ${suffix}`;

  const chips: string[] = [];
  if (meta.cutDepth !== null) {
    const passes = meta.cutLevels.length > 1 ? ` · ${meta.cutLevels.length} passes` : "";
    chips.push(`Total depth ${fmt(meta.cutDepth)}${unit.trim()}${passes}`);
  }
  if (meta.passDepths.length > 0) {
    const sorted = [...meta.passDepths].sort((a, b) => a - b);
    chips.push(
      meta.stepdown !== null
        ? `DoC ${fmt(meta.stepdown)}${unit.trim()}`
        : `DoC ${fmt(sorted[0])}–${fmt(sorted[sorted.length - 1])}${unit.trim()}`,
    );
  }
  if (meta.toolDiameter !== null) chips.push(`Ø${fmt(meta.toolDiameter)}${unit.trim()} tool`);
  if (meta.feeds.length > 0) chips.push(range(meta.feeds, feedUnit));
  if (meta.spindleSpeeds.length > 0) chips.push(range(meta.spindleSpeeds, "RPM"));

  return (
    <div className="space-y-2">
      <GcodeViewer toolpath={tp} className="h-[55svh] min-h-64 lg:h-[60svh]" />
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip} variant="secondary" className="font-normal tabular-nums">
              {chip}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {tp.segments.filter((s) => !s.rapid).length.toLocaleString()} cutting moves · envelope{" "}
        {size.x.toFixed(2)}×{size.y.toFixed(2)}×{size.z.toFixed(2)}
        {unit}
      </p>
    </div>
  );
}
