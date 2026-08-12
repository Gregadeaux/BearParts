/**
 * Reference table of standard hole sizes used by the team (inches).
 * All classification happens against this list — add new standards here.
 */
export type HoleKind = "tap" | "close-fit" | "free-fit" | "bearing" | "shaft";

export interface HoleStandard {
  /** short label shown in the UI, e.g. "10-32 tap" */
  label: string;
  kind: HoleKind;
  /** exact drill/bore diameter in inches */
  diameter: number;
  /** drill callout, e.g. "#21" */
  drill?: string;
  note?: string;
}

export const HOLE_STANDARDS: HoleStandard[] = [
  // #10 (10-32) — workhorse FRC bolt
  { label: "10-32 tap", kind: "tap", diameter: 0.159, drill: "#21" },
  { label: "#10 close fit", kind: "close-fit", diameter: 0.196, drill: "#9" },
  { label: "#10 free fit", kind: "free-fit", diameter: 0.201, drill: "#7" },
  // 1/4-20
  { label: "1/4-20 tap", kind: "tap", diameter: 0.201, drill: "#7" },
  { label: "1/4\" close fit", kind: "close-fit", diameter: 0.257, drill: "F" },
  { label: "1/4\" free fit", kind: "free-fit", diameter: 0.266, drill: "H" },
  // bearings & shafts
  {
    label: "1.125\" bearing bore",
    kind: "bearing",
    diameter: 1.125,
    note: "flanged bearing for 1/2\" hex shaft",
  },
  {
    label: "0.875\" bearing bore",
    kind: "bearing",
    diameter: 0.875,
    note: "flanged bearing for 3/8\" hex shaft",
  },
  { label: "1/2\" shaft clearance", kind: "shaft", diameter: 0.5 },
  { label: "3/8\" shaft clearance", kind: "shaft", diameter: 0.375 },
];

/** How far (inches) a measured diameter may deviate from a standard and still match. */
export const HOLE_MATCH_TOLERANCE_IN = 0.005;
