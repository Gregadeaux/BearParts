import type { Layer } from "./canvas";
import { boxesOverlap, boxInside, pointInPolygon, segmentsCross } from "./collision";
import { arrowhead, DIM } from "./dims";
import { add, line, mul, pt, text, type Pt, type TextShape } from "./primitives";
import { textBox, type Box } from "./text-metrics";

export interface CalloutLine {
  text: string;
  size: number;
}

/** Where a leader may land: arrow tip on the feature, leader leaving along `dir`. */
export interface LeaderAnchor {
  tip: Pt;
  dir: Pt;
}

const LEADER_LENGTHS = [0.3, 0.45, 0.6, 0.8, 1.0, 1.25, 1.5, 1.9, 2.4, 3.0];
const LINE_GAP = 0.05;

interface Candidate {
  anchor: LeaderAnchor;
  elbow: Pt;
  shoulderEnd: Pt;
  texts: TextShape[];
  box: Box;
  score: number;
}

/**
 * Leader callout placement. Tries leader angles × lengths, rejects any
 * candidate whose text hits existing shapes or leaves `region`, or whose
 * leader crosses text or another leader; scores the rest by leader length
 * plus crossings of existing lines. Draws the winner and records it.
 */
export class CalloutPlacer {
  private leaders: [Pt, Pt][] = [];
  /**
   * @param soft areas text may use but shouldn't (ordinate bands)
   * @param parts view outlines — callouts prefer to sit outside the views
   */
  constructor(
    private layer: Layer,
    private region: Box,
    private soft: Box[] = [],
    private parts: Pt[][] = [],
  ) {}

  /** @param arrow false when the leader continues a dimension line that has its own arrows */
  place(lines: CalloutLine[], anchors: LeaderAnchor[], arrow = true): boolean {
    return this.placeAt(lines, anchors, arrow) !== null;
  }

  /** Like `place`, but returns the anchor that won (null if none fit). */
  placeAt(lines: CalloutLine[], anchors: LeaderAnchor[], arrow = true): LeaderAnchor | null {
    let best = null as Candidate | null;
    for (const strict of [true, false]) {
      for (const anchor of anchors) {
        for (const L of LEADER_LENGTHS) {
          const c = this.candidate(lines, anchor, L, strict);
          if (c && (!best || c.score < best.score)) best = c;
        }
      }
      if (best) break;
    }
    if (!best) return null;
    this.draw(best, arrow);
    return best.anchor;
  }

  private candidate(lines: CalloutLine[], anchor: LeaderAnchor, L: number, strict: boolean): Candidate | null {
    const elbow = add(anchor.tip, mul(anchor.dir, L));
    const side = anchor.dir.x >= 0 ? 1 : -1;
    // nearly horizontal leaders need no shoulder
    const shoulder = Math.abs(anchor.dir.y) < 0.26 ? 0 : DIM.shoulder;
    const shoulderEnd = pt(elbow.x + side * shoulder, elbow.y);
    const tx = shoulderEnd.x + side * 0.05;
    const texts: TextShape[] = [];
    let y = elbow.y;
    lines.forEach((l, i) => {
      if (i > 0) y -= lines[i - 1].size / 2 + LINE_GAP + l.size / 2;
      texts.push(text(l.text, pt(tx, y), l.size, { align: side > 0 ? "left" : "right", valign: "middle" }));
    });
    const box = texts.map((t) => textBox(t, 0.03)).reduce(union);
    if (!boxInside(box, this.region)) return null;

    const occ = this.layer.occ;
    const start = add(anchor.tip, mul(anchor.dir, 0.03));
    const segs: [Pt, Pt][] = [[start, elbow]];
    if (shoulder > 0) segs.push([elbow, shoulderEnd]);
    if (segs.some(([a, b]) => occ.segHitsBoxes(a, b))) return null;
    if (segs.some(([a, b]) => this.leaders.some(([c, d]) => segmentsCross(a, b, c, d)))) return null;

    let penalty = 0;
    if (occ.boxHits(box)) {
      if (strict) return null;
      penalty += 20;
    }
    for (const s of this.soft) if (boxesOverlap(box, s)) penalty += 1.2;
    // ASME: place annotations outside the view where practical
    const mid = pt((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
    if (this.parts.some((p) => pointInPolygon(mid, p))) penalty += 0.5;
    const crossings = segs.reduce((n, [a, b]) => n + occ.segCrossings(a, b), 0);
    return { anchor, elbow, shoulderEnd, texts, box, score: L + 0.6 * crossings + penalty };
  }

  private draw(c: Candidate, arrow: boolean) {
    const layer = this.layer;
    layer.path(line(c.anchor.tip, c.elbow));
    if (c.shoulderEnd.x !== c.elbow.x) layer.path(line(c.elbow, c.shoulderEnd));
    if (arrow) arrowhead(layer, c.anchor.tip, mul(c.anchor.dir, -1));
    for (const t of c.texts) layer.text(t, false);
    layer.occ.addBox(c.box);
    this.leaders.push([c.anchor.tip, c.elbow], [c.elbow, c.shoulderEnd]);
  }
}

/** Radial leader anchors around a circle, preferring the 45° diagonals. */
export function circleAnchors(center: Pt, r: number): LeaderAnchor[] {
  const degs = [45, 135, 315, 225, 30, 150, 330, 210, 60, 120, 300, 240];
  return degs.map((d) => {
    const a = (d * Math.PI) / 180;
    const dir = pt(Math.cos(a), Math.sin(a));
    return { tip: add(center, mul(dir, r)), dir };
  });
}

const union = (a: Box, b: Box): Box => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

/** Place a short label (hole-table tag) right beside a point, no leader. */
export function placeTag(layer: Layer, region: Box, c: Pt, r: number, label: string, size: number): void {
  const degs = [45, 135, 315, 225, 90, 0, 180, 270];
  let fallback: TextShape | null = null;
  for (const d of degs) {
    const a = (d * Math.PI) / 180;
    const dir = pt(Math.cos(a), Math.sin(a));
    const at = add(c, mul(dir, r + 0.05));
    const t = text(label, at, size, {
      align: dir.x > 0.3 ? "left" : dir.x < -0.3 ? "right" : "center",
      valign: dir.y > 0.3 ? "bottom" : dir.y < -0.3 ? "top" : "middle",
    });
    const b = textBox(t, 0.02);
    fallback ??= t;
    if (boxInside(b, region) && !layer.occ.boxHits(b)) {
      layer.text(t, true, 0.02);
      return;
    }
  }
  if (fallback) layer.text(fallback, true, 0.02);
}
