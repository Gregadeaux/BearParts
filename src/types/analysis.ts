import type { BoundingBox, Point } from "./geometry";
import type { HoleKind } from "@/services/dxf/machining-standards";

export type Units = "in" | "mm" | "unknown";

export interface HoleMatch {
  label: string;
  kind: HoleKind;
  nominalDiameter: number;
  /** measured − nominal, inches */
  deviation: number;
  drill?: string;
  note?: string;
}

export interface AnalyzedHole {
  center: Point;
  /** inches */
  diameter: number;
  matches: HoleMatch[];
}

/** Holes grouped by identical diameter for the summary table. */
export interface HoleGroup {
  diameter: number;
  count: number;
  matches: HoleMatch[];
}

export interface PocketAnalysis {
  /** index into the analysis' loop list (viewer overlay lookup) */
  loopIndex: number;
  kind: "pocket" | "outer-profile";
  /** smallest concave fillet radius found, inches */
  minFilletRadius: number | null;
  /** largest endmill that can cut every filleted corner, inches */
  maxEndmillDiameter: number | null;
  /** locations of sharp (zero-radius) internal corners */
  sharpCorners: Point[];
}

/** A concrete endmill from the shop's metric catalog. */
export interface EndmillOption {
  sizeMm: number;
  diameterIn: number;
}

/** Tooling recommendation — holes are interpolated with endmills, not drilled. */
export interface EndmillPlan {
  /** largest single endmill that can cut everything, including bolt holes */
  single: EndmillOption | null;
  /** two-tool option: small endmill for bolt holes, larger one for the rest */
  split: { boltHoles: EndmillOption; rest: EndmillOption } | null;
}

export interface DxfAnalysis {
  units: Units;
  unitsSource: "header" | "heuristic" | "assumed";
  boundingBox: BoundingBox;
  holes: AnalyzedHole[];
  holeGroups: HoleGroup[];
  pockets: PocketAnalysis[];
  /** overall largest endmill able to cut every internal corner, inches (raw geometric limit) */
  maxEndmillDiameter: number | null;
  endmills: EndmillPlan;
  sharpCornerCount: number;
  entityCounts: Record<string, number>;
  warnings: string[];
}
