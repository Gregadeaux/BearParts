/**
 * Minimal G-code toolpath parser — linear moves (G0/G1) plus XY-plane arcs
 * (G2/G3 with I/J or R). Pure and dependency-free like the DXF/STL parsers.
 * Enough to draw the path; it is NOT a simulator (no tool comp, no canned cycles).
 */

export interface GcodeSegment {
  from: [number, number, number];
  to: [number, number, number];
  /** G0 positioning move (drawn faded) vs cutting move */
  rapid: boolean;
  /** programmed feed (units/min) in effect for this cutting move */
  feed?: number;
}

export interface GcodeMeta {
  /** distinct programmed feed rates on cutting moves (units/min), ascending */
  feeds: number[];
  /** distinct spindle speeds (RPM), ascending */
  spindleSpeeds: number[];
  /** distinct Z levels with lateral cutting, top first */
  cutLevels: number[];
  /** total depth of cut: |deepest level| below Z0, else the level span */
  cutDepth: number | null;
  /** depth of cut per pass, in pass order (first pass measured from Z0) */
  passDepths: number[];
  /** uniform step-down between passes, when consistent */
  stepdown: number | null;
}

export interface GcodeToolpath {
  segments: GcodeSegment[];
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  /** true when the file declared inches (G20) */
  inches: boolean;
  meta: GcodeMeta;
}

const MAX_SEGMENTS = 250_000;
const ARC_CHORD_DEG = 5;

export function parseGcode(text: string): GcodeToolpath {
  const segments: GcodeSegment[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let absolute = true;
  let motion: 0 | 1 | 2 | 3 = 0;
  let inches = false;
  let sawMove = false;
  let currentFeed = 0;
  const feeds = new Set<number>();
  const spindleSpeeds = new Set<number>();
  const cutLevels = new Set<number>();

  for (const rawLine of text.split(/\r?\n/)) {
    // strip ( ... ) and ; comments, then tokenize words like G1 X1.5
    const line = rawLine.replace(/\([^)]*\)/g, "").replace(/;.*$/, "");
    if (!line.trim()) continue;
    const words = [...line.matchAll(/([A-Za-z])\s*([+-]?\d*\.?\d+)/g)];
    if (words.length === 0) continue;

    let nx: number | null = null;
    let ny: number | null = null;
    let nz: number | null = null;
    let i = 0;
    let j = 0;
    let r: number | null = null;
    let hasIJ = false;
    let lineMotion: 0 | 1 | 2 | 3 | null = null;

    for (const [, letter, valueStr] of words) {
      const value = parseFloat(valueStr);
      switch (letter.toUpperCase()) {
        case "G": {
          const code = Math.floor(value);
          if (code >= 0 && code <= 3) lineMotion = code as 0 | 1 | 2 | 3;
          else if (code === 20) inches = true;
          else if (code === 21) inches = false;
          else if (code === 90) absolute = true;
          else if (code === 91) absolute = false;
          break;
        }
        case "X":
          nx = absolute ? value : x + value;
          break;
        case "Y":
          ny = absolute ? value : y + value;
          break;
        case "Z":
          nz = absolute ? value : z + value;
          break;
        case "I":
          i = value;
          hasIJ = true;
          break;
        case "J":
          j = value;
          hasIJ = true;
          break;
        case "R":
          r = value;
          break;
        case "F":
          currentFeed = value;
          break;
        case "S":
          if (value > 0) spindleSpeeds.add(value);
          break;
      }
    }

    if (lineMotion !== null) motion = lineMotion;
    if (nx === null && ny === null && nz === null) continue;

    const tx = nx ?? x;
    const ty = ny ?? y;
    const tz = nz ?? z;

    const feed = motion !== 0 && currentFeed > 0 ? currentFeed : undefined;
    if (motion === 2 || motion === 3) {
      emitArc(segments, x, y, z, tx, ty, tz, i, j, r, hasIJ, motion === 2, feed);
    } else {
      segments.push({ from: [x, y, z], to: [tx, ty, tz], rapid: motion === 0, feed });
    }
    if (motion !== 0) {
      if (currentFeed > 0) feeds.add(currentFeed);
      // a pass level = lateral cutting at constant Z (plunges don't count)
      const lateral = Math.abs(tx - x) > 1e-9 || Math.abs(ty - y) > 1e-9;
      if (lateral && Math.abs(tz - z) < 1e-9) {
        cutLevels.add(Math.round(tz * 1e4) / 1e4);
      }
    }
    sawMove = true;
    x = tx;
    y = ty;
    z = tz;
    if (segments.length > MAX_SEGMENTS) throw new Error("G-code file is too large to preview");
  }

  if (!sawMove || segments.length === 0) throw new Error("No toolpath moves found");
  return {
    segments,
    boundingBox: computeBBox(segments),
    inches,
    meta: buildMeta(feeds, spindleSpeeds, cutLevels),
  };
}

function buildMeta(
  feeds: Set<number>,
  spindleSpeeds: Set<number>,
  cutLevelSet: Set<number>,
): GcodeMeta {
  const cutLevels = [...cutLevelSet].sort((a, b) => b - a); // top first
  let cutDepth: number | null = null;
  if (cutLevels.length > 0) {
    const deepest = cutLevels[cutLevels.length - 1];
    // stock top at Z0 is the near-universal router convention
    cutDepth = deepest < -1e-6 ? Math.abs(deepest) : cutLevels[0] - deepest;
    if (cutDepth < 1e-6) cutDepth = null;
  }

  // per-pass DoC: first pass from stock top (Z0 convention), then level→level
  const passDepths: number[] = [];
  if (cutLevels.length > 0) {
    let prev = cutLevels[0] < -1e-6 ? 0 : cutLevels[0];
    for (const lvl of cutLevels) {
      const d = prev - lvl;
      if (d > 1e-6) passDepths.push(Math.round(d * 1e4) / 1e4);
      prev = lvl;
    }
  }

  let stepdown: number | null = null;
  if (passDepths.length >= 1) {
    const first = passDepths[0];
    if (passDepths.every((d) => Math.abs(d - first) < 1e-3)) {
      stepdown =
        Math.round((passDepths.reduce((a, b) => a + b, 0) / passDepths.length) * 1e4) / 1e4;
    }
  }

  return {
    feeds: [...feeds].sort((a, b) => a - b),
    spindleSpeeds: [...spindleSpeeds].sort((a, b) => a - b),
    cutLevels,
    cutDepth,
    passDepths,
    stepdown,
  };
}

/** XY-plane arc → chord segments. Helical Z is interpolated linearly. */
function emitArc(
  out: GcodeSegment[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  i: number,
  j: number,
  r: number | null,
  hasIJ: boolean,
  clockwise: boolean,
  feed?: number,
) {
  let cx: number;
  let cy: number;
  if (hasIJ) {
    cx = x0 + i;
    cy = y0 + j;
  } else if (r !== null) {
    // R format: midpoint-perpendicular construction; sign of R picks the side
    const dx = x1 - x0;
    const dy = y1 - y0;
    const q = Math.hypot(dx, dy);
    if (q < 1e-9 || Math.abs(r) < q / 2 - 1e-9) {
      out.push({ from: [x0, y0, z0], to: [x1, y1, z1], rapid: false, feed });
      return;
    }
    const h = Math.sqrt(Math.max(0, r * r - (q / 2) * (q / 2)));
    const side = clockwise === r > 0 ? -1 : 1;
    cx = (x0 + x1) / 2 + side * h * (-dy / q);
    cy = (y0 + y1) / 2 + side * h * (dx / q);
  } else {
    out.push({ from: [x0, y0, z0], to: [x1, y1, z1], rapid: false, feed });
    return;
  }

  const radius = Math.hypot(x0 - cx, y0 - cy);
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  let a1 = Math.atan2(y1 - cy, x1 - cx);
  const fullCircle = Math.abs(x1 - x0) < 1e-9 && Math.abs(y1 - y0) < 1e-9;
  if (clockwise) {
    while (a1 >= a0 - 1e-12) a1 -= 2 * Math.PI;
    if (fullCircle) a1 = a0 - 2 * Math.PI;
  } else {
    while (a1 <= a0 + 1e-12) a1 += 2 * Math.PI;
    if (fullCircle) a1 = a0 + 2 * Math.PI;
  }

  const sweep = a1 - a0;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / ((ARC_CHORD_DEG * Math.PI) / 180)));
  let px = x0;
  let py = y0;
  let pz = z0;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const a = a0 + sweep * t;
    const qx = cx + radius * Math.cos(a);
    const qy = cy + radius * Math.sin(a);
    const qz = z0 + (z1 - z0) * t;
    out.push({ from: [px, py, pz], to: [qx, qy, qz], rapid: false, feed });
    px = qx;
    py = qy;
    pz = qz;
  }
}

function computeBBox(segments: GcodeSegment[]): GcodeToolpath["boundingBox"] {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const seg of segments) {
    for (const [px, py, pz] of [seg.from, seg.to]) {
      min.x = Math.min(min.x, px);
      min.y = Math.min(min.y, py);
      min.z = Math.min(min.z, pz);
      max.x = Math.max(max.x, px);
      max.y = Math.max(max.y, py);
      max.z = Math.max(max.z, pz);
    }
  }
  return {
    min,
    max,
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
  };
}
