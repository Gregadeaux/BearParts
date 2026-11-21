import type { HoleStack, ModelFeatures } from "@/services/dimensions/model-features";
import { modelHolePatterns, type HolePatternSet, type PatternDirection } from "@/services/dimensions/hole-patterns";
import type { CalloutLine } from "./callouts";
import { DIM } from "./dims";
import { countPrefix, fmtIn } from "./format";
import type { LineView, V3, ViewBasis } from "./hlr";
import { MAX_ORDINATES } from "./dxf-plan";
import { DEPTH, DIA } from "./text-metrics";

export type ViewName = "front" | "top" | "right";

/** A physical hole as seen in one view: center at the end facing the viewer. */
export interface SeenHole {
  stack: number;
  center: V3;
  /** view coordinates (model inches) */
  u: number;
  v: number;
  diameter: number;
}

/** One pattern direction to dimension in a view (from the shared pattern API). */
export interface AxisDim {
  dir: "u" | "v";
  d: PatternDirection;
  /** +1 when the pattern direction runs with the view axis, −1 against it */
  sign: 1 | -1;
  /** the pattern's holes visible in this view */
  holes: SeenHole[];
  pattern: HolePatternSet;
}

export interface ViewHolePlan {
  view: ViewName;
  holes: SeenHole[];
  callouts: { lines: CalloutLine[]; holes: SeenHole[] }[];
  dims: AxisDim[];
  /** some pattern isn't a clean grid: locate every hole by ordinates instead */
  ordinates: boolean;
  /** holes left unlocated (too many ordinates) */
  unlocated: boolean;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3 = (p: { x: number; y: number; z: number }): V3 => [p.x, p.y, p.z];
const at = (c: { x: number; y: number; z: number }, a: { x: number; y: number; z: number }, t: number): V3 => [c.x + a.x * t, c.y + a.y * t, c.z + a.z * t];

/** Which model axis (0 x, 1 y, 2 z) a direction runs along. */
export const modelAxis = (d: V3) => [0, 1, 2].reduce((m, k) => (Math.abs(d[k]) > Math.abs(d[m]) ? k : m), 0);

/**
 * Plan hole dimensioning per orthographic view from the shared pattern
 * analysis (services/dimensions/hole-patterns): physical holes visible down
 * their axis, one callout per diameter/termination, and for each pattern its
 * edge distance + pitch in both directions — or ordinates when a pattern is
 * irregular. A direction another view already dimensions is not repeated.
 */
export function planViewHoles(f: ModelFeatures, views: { name: ViewName; basis: ViewBasis; view: LineView }[]): ViewHolePlan[] {
  const patterns = modelHolePatterns(f);
  const done = new Set<string>();
  const plans: ViewHolePlan[] = [];
  for (const { name, basis, view } of views) {
    const holes: SeenHole[] = [];
    const inView: HolePatternSet[] = [];
    for (const p of patterns) {
      if (Math.abs(dot(v3(p.axis), basis.fwd)) < 0.999) continue;
      let any = false;
      for (const k of p.holes) {
        const s = f.stacks[k];
        const ends = [at(s.center, s.axis, s.extent[0]), at(s.center, s.axis, s.extent[1])];
        const near = dot(ends[0], basis.fwd) < dot(ends[1], basis.fwd) ? ends[0] : ends[1];
        if (!rimVisible(view, near, v3(s.axis), s.diameter)) continue;
        holes.push({ stack: k, center: near, u: dot(near, basis.right), v: dot(near, basis.up), diameter: s.diameter });
        any = true;
      }
      if (any) inView.push(p);
    }
    if (holes.length === 0) continue;
    const irregular = inView.some((p) => p.kind === "irregular");
    const dims: AxisDim[] = [];
    if (!irregular) {
      for (const p of inView) {
        const seen = holes.filter((h) => p.holes.includes(h.stack));
        for (const d of p.directions!) {
          const e = v3(d.dir);
          const along = Math.abs(dot(e, basis.right)) > 0.999 ? "u" : Math.abs(dot(e, basis.up)) > 0.999 ? "v" : null;
          if (!along) continue;
          const key = `${modelAxis(e)}|${d.datum}|${d.datumAt.toFixed(3)}|${d.edgeDistance.toFixed(3)}|${d.pitch.toFixed(3)}|${d.count}`;
          if (done.has(key)) continue;
          done.add(key);
          const sign = dot(e, along === "u" ? basis.right : basis.up) > 0 ? 1 : -1;
          dims.push({ dir: along, d, sign, holes: seen, pattern: p });
        }
      }
    }
    const us = new Set(holes.map((h) => h.u.toFixed(3))).size;
    const vs = new Set(holes.map((h) => h.v.toFixed(3))).size;
    const ordinates = irregular && us < MAX_ORDINATES && vs < MAX_ORDINATES;
    plans.push({ view: name, holes, callouts: calloutGroups(f, holes), dims, ordinates, unlocated: irregular && !ordinates });
  }
  return plans;
}

/** Dimension rows a view's pattern needs along one direction (edge + pitch per pattern). */
export function planRows(plans: ViewHolePlan[], view: string, dir: "u" | "v"): number {
  const p = plans.find((q) => q.view === view);
  return (p?.dims ?? []).filter((d) => d.dir === dir).reduce((n, d) => n + (d.d.count > 1 ? 2 : 1), 0);
}

/** Probe just outside the rim on the face the hole opens into. */
function rimVisible(view: LineView, c: V3, a: V3, d: number): boolean {
  const u: V3 = Math.abs(a[0]) < 0.9 ? [0, a[2], -a[1]] : [a[1], -a[0], 0];
  const ul = Math.hypot(...u);
  const w: V3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const r = (d / 2) * 1.08 + 0.005;
  let seen = 0;
  for (let k = 0; k < 8; k++) {
    const cs = (Math.cos((k * Math.PI) / 4) * r) / ul, sn = (Math.sin((k * Math.PI) / 4) * r) / ul;
    if (view.probe([c[0] + u[0] * cs + w[0] * sn, c[1] + u[1] * cs + w[1] * sn, c[2] + u[2] * cs + w[2] * sn])) seen++;
  }
  return seen >= 5;
}

/** "39X ⌀.196 THRU", "4X ⌀.196 THRU ONE WALL", "⌀.250 ↧.500" — one per kind. */
function calloutGroups(f: ModelFeatures, holes: SeenHole[]): ViewHolePlan["callouts"] {
  const term = (s: HoleStack) => {
    const cyl = s.members.map((i) => f.cylinders[i]);
    if (s.throughPart) return " THRU";
    if (cyl.every((c) => !c.blind)) return " THRU ONE WALL";
    return cyl.length === 1 ? ` ${DEPTH}${fmtIn(cyl[0].extent[1] - cyl[0].extent[0])}` : "";
  };
  const groups = new Map<string, SeenHole[]>();
  for (const h of holes) {
    const key = `${h.diameter.toFixed(4)}${term(f.stacks[h.stack])}`;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  return [...groups.values()].map((g) => {
    const lines: CalloutLine[] = [{ text: `${countPrefix(g.length)}${DIA}${fmtIn(g[0].diameter)}${term(f.stacks[g[0].stack])}`, size: DIM.textH }];
    const pattern = f.holes.find((h) => h.stacks.includes(g[0].stack));
    if (pattern?.boltCircle && g.length === pattern.stacks.length) lines.push({ text: `EQ SP ON ${DIA}${fmtIn(pattern.boltCircle.diameter)} B.C.`, size: DIM.textH });
    return { lines, holes: g };
  });
}
