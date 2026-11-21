/**
 * Feature recognition for STEP models: fits a primitive to every B-rep face
 * of the tessellated model (occt-import-js `brep_faces`) and reports
 * cylinders (bores / bosses), coaxial hole patterns with bolt circles,
 * planes, and — for turned parts — the stepped profile and grooves.
 *
 * Pure and isomorphic (no React / three / jsPDF). Input in inches; all
 * outputs in inches. STL has no faces, so it isn't supported here.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ModelCylinder {
  /** unit axis, canonical sign (largest component positive) */
  axis: Vec3;
  /** point on the axis closest to the model origin */
  origin: Vec3;
  diameter: number;
  /** bore = material outside (hole); boss = material inside (OD, pin) */
  kind: "bore" | "boss";
  /** the face wraps the full 360° (a fillet/round is a partial arc) */
  full: boolean;
  /** [start, end] along `axis`, measured from `origin` */
  extent: [number, number];
  /** blind holes only: a bottom face closes the bore at one end */
  blind: boolean;
  area: number;
  faceIds: number[];
}

export interface HolePattern {
  axis: Vec3;
  diameter: number;
  count: number;
  /** indices into `cylinders` */
  members: number[];
  /** all ends open (no bottom face found) */
  thru: boolean;
  /** members equally spaced on a circle about a common center */
  boltCircle: { center: Vec3; diameter: number } | null;
  /** indices into `ModelFeatures.stacks`: the physical holes of this pattern */
  stacks: number[];
}

/**
 * One physical drilled hole: the coaxial bores of equal diameter it leaves
 * in every wall it crosses (a hole through both walls of a tube is two
 * cylinders but one stack).
 */
export interface HoleStack {
  axis: Vec3;
  /** axis point closest to the model origin (same as the members' origins) */
  center: Vec3;
  diameter: number;
  /** indices into `cylinders`, ordered along `axis` */
  members: number[];
  /** [start, end] along `axis` from `center`, over all members */
  extent: [number, number];
  /** a line down the hole's axis meets no material: open through the whole part */
  throughPart: boolean;
}

export interface ModelPlane {
  /** unit normal pointing out of the material */
  normal: Vec3;
  /** signed distance of the plane from the origin along `normal` */
  offset: number;
  area: number;
}

export interface TurnedProfile {
  axis: Vec3;
  origin: Vec3;
  /** axial range of the part, from `origin` along `axis` */
  extent: [number, number];
  /** outside-diameter segments in axial order */
  steps: { diameter: number; start: number; end: number }[];
  /** OD segments smaller than both neighbors */
  grooves: { rootDiameter: number; start: number; end: number; width: number }[];
  /** axial positions of faces perpendicular to the axis (shoulders, groove walls, ends) */
  shoulders: number[];
}

export interface ModelFeatures {
  cylinders: ModelCylinder[];
  /** full bores grouped by diameter and direction (singles included) */
  holes: HolePattern[];
  /** physical holes: coaxial bores of one diameter merged across walls */
  stacks: HoleStack[];
  planes: ModelPlane[];
  turned: TurnedProfile | null;
  /** share of surface area on faces that are neither planes nor cylinders */
  otherAreaFraction: number;
  /** axis-aligned bounding box of the model */
  bounds: { min: Vec3; max: Vec3 };
}

type V = [number, number, number];
/**
 * A cylinder is full when its vertices leave no angular gap wider than 60°
 * (one tessellation facet is ~10–15°; a fillet's gap is 180°+).
 */
const FULL = 2 * Math.PI - Math.PI / 3;
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const addv = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => scale(a, 1 / (Math.hypot(...a) || 1));
const vec = (a: V): Vec3 => ({ x: a[0], y: a[1], z: a[2] });
const canonical = (a: V): V => {
  const i = [0, 1, 2].reduce((m, k) => (Math.abs(a[k]) > Math.abs(a[m]) ? k : m), 0);
  return a[i] < 0 ? scale(a, -1) : a;
};

interface Face {
  id: number;
  tris: number[];
  verts: V[];
  area: number;
  /** area-weighted normal covariance */
  cov: number[];
  normalSum: V;
}

/** Recognize planes, cylinders, hole patterns and turned profiles. */
export function recognizeModelFeatures(positions: ArrayLike<number>, faceIds: ArrayLike<number>): ModelFeatures {
  const faces = collectFaces(positions, faceIds);
  const totalArea = faces.reduce((s, f) => s + f.area, 0) || 1;
  const orient = signedVolume(positions) < 0 ? -1 : 1; // normals point out of material
  const ext = extentOf(positions);
  const tol = Math.max(ext * 2e-4, 1e-4);

  const planes: ModelPlane[] = [];
  const raw: RawCylinder[] = [];
  let otherArea = 0;
  for (const f of faces) {
    const fit = fitFace(f, orient, tol);
    if (fit?.type === "plane") planes.push(fit.plane);
    else if (fit?.type === "cylinder") raw.push(fit.cylinder);
    else otherArea += f.area;
  }
  const cylinders: ModelCylinder[] = mergeCoaxial(raw, tol).map((c) => {
    const out: ModelCylinder & { arc?: number } = { ...c };
    delete out.arc; // internal merge bookkeeping
    return out;
  });
  for (const c of cylinders) if (c.kind === "bore") c.blind = hasBottom(c, faces, tol);
  const holes = holePatterns(cylinders, tol);
  const stacks = holeStacks(holes, cylinders, positions, tol);
  return {
    cylinders,
    holes,
    stacks,
    planes,
    turned: turnedProfile(cylinders, planes, positions, tol),
    otherAreaFraction: otherArea / totalArea,
    bounds: boundsOf(positions),
  };
}

function boundsOf(p: ArrayLike<number>): { min: Vec3; max: Vec3 } {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[i + k]);
      hi[k] = Math.max(hi[k], p[i + k]);
    }
  }
  return { min: vec(lo as V), max: vec(hi as V) };
}

function collectFaces(p: ArrayLike<number>, ids: ArrayLike<number>): Face[] {
  const map = new Map<number, Face>();
  for (let t = 0; t < p.length / 9; t++) {
    const id = ids[t];
    if (id < 0) continue;
    const a: V = [p[t * 9], p[t * 9 + 1], p[t * 9 + 2]];
    const b: V = [p[t * 9 + 3], p[t * 9 + 4], p[t * 9 + 5]];
    const c: V = [p[t * 9 + 6], p[t * 9 + 7], p[t * 9 + 8]];
    const n2 = cross(sub(b, a), sub(c, a));
    const area = Math.hypot(...n2) / 2;
    if (area <= 0) continue;
    const n = norm(n2);
    let f = map.get(id);
    if (!f) map.set(id, (f = { id, tris: [], verts: [], area: 0, cov: [0, 0, 0, 0, 0, 0, 0, 0, 0], normalSum: [0, 0, 0] }));
    f.tris.push(t);
    f.verts.push(a, b, c);
    f.area += area;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) f.cov[i * 3 + j] += area * n[i] * n[j];
    f.normalSum = addv(f.normalSum, scale(n, area));
  }
  return [...map.values()];
}

/** cylinder plus its angular coverage (radians) while faces are being merged */
type RawCylinder = ModelCylinder & { arc: number };
type Fit = { type: "plane"; plane: ModelPlane } | { type: "cylinder"; cylinder: RawCylinder } | null;

function fitFace(f: Face, orient: number, tol: number): Fit {
  const { values, vectors } = eigenSym3(f.cov.map((v) => v / f.area));
  // plane: every normal the same → only one non-zero eigenvalue
  if (values[1] < 1e-5) {
    const n = norm(scale(f.normalSum, orient));
    const offsets = f.verts.map((v) => dot(v, n));
    const mean = offsets.reduce((s, o) => s + o, 0) / offsets.length;
    if (offsets.some((o) => Math.abs(o - mean) > tol)) return null;
    return { type: "plane", plane: { normal: vec(n), offset: mean, area: f.area } };
  }
  // cylinder: normals all perpendicular to one direction (the axis)
  if (values[0] > 1e-4) return null;
  const axis = canonical(norm(vectors[0]));
  const u = norm(Math.abs(axis[0]) < 0.9 ? cross(axis, [1, 0, 0]) : cross(axis, [0, 1, 0]));
  const w = cross(axis, u);
  const pts = f.verts.map((v) => [dot(v, u), dot(v, w)] as [number, number]);
  const circle = fitCircle(pts);
  if (!circle || circle.r <= 0) return null;
  const resid = Math.max(...pts.map(([x, y]) => Math.abs(Math.hypot(x - circle.cx, y - circle.cy) - circle.r)));
  if (resid > Math.max(tol, circle.r * 1e-3)) return null;
  // concave (bore) if outward normals point toward the axis
  let outward = 0;
  for (let i = 0; i < f.tris.length; i++) {
    const [a, b, c] = [f.verts[i * 3], f.verts[i * 3 + 1], f.verts[i * 3 + 2]];
    const n = scale(norm(cross(sub(b, a), sub(c, a))), orient);
    const m = scale(addv(addv(a, b), c), 1 / 3);
    const radial: V = [dot(m, u) - circle.cx, dot(m, w) - circle.cy, 0];
    outward += Math.sign(dot(n, u) * radial[0] + dot(n, w) * radial[1]);
  }
  const center = addv(scale(u, circle.cx), scale(w, circle.cy));
  const ts = f.verts.map((v) => dot(v, axis));
  const arc = coverage(pts, circle);
  return {
    type: "cylinder",
    cylinder: {
      axis: vec(axis),
      origin: vec(center),
      diameter: 2 * circle.r,
      kind: outward < 0 ? "bore" : "boss",
      full: arc > FULL,
      arc,
      extent: [Math.min(...ts), Math.max(...ts)],
      blind: false,
      area: f.area,
      faceIds: [f.id],
    },
  };
}

/** Angular coverage (radians) of points around a circle center. */
function coverage(pts: [number, number][], c: { cx: number; cy: number }): number {
  const a = pts.map(([x, y]) => Math.atan2(y - c.cy, x - c.cx)).sort((p, q) => p - q);
  let gap = a[0] + 2 * Math.PI - a[a.length - 1];
  for (let i = 1; i < a.length; i++) gap = Math.max(gap, a[i] - a[i - 1]);
  return 2 * Math.PI - gap;
}

/** Algebraic (Kåsa) least-squares circle fit. */
function fitCircle(pts: [number, number][]): { cx: number; cy: number; r: number } | null {
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const [x, y] of pts) {
    const a = x - mx, b = y - my;
    suu += a * a; suv += a * b; svv += b * b;
    suuu += a * a * a; svvv += b * b * b; suvv += a * b * b; svuu += b * a * a;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-18) return null;
  const r1 = (suuu + suvv) / 2, r2 = (svvv + svuu) / 2;
  const uc = (r1 * svv - r2 * suv) / det;
  const vc = (r2 * suu - r1 * suv) / det;
  return { cx: uc + mx, cy: vc + my, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) };
}

/** Jacobi eigen-decomposition of a symmetric 3×3 (row-major); ascending values. */
export function eigenSym3(m: number[]): { values: number[]; vectors: V[] } {
  const a = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
    if (off < 1e-24) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-30) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => [v[0][i], v[1][i], v[2][i]] as V) };
}

const toV = (p: Vec3): V => [p.x, p.y, p.z];

function sameAxisLine(a: ModelCylinder, b: ModelCylinder, tol: number): boolean {
  const da = toV(a.axis), db = toV(b.axis);
  if (Math.abs(dot(da, db)) < Math.cos((0.5 * Math.PI) / 180)) return false;
  const d = sub(toV(b.origin), toV(a.origin));
  const perp = sub(d, scale(da, dot(d, da)));
  return Math.hypot(...perp) < tol * 5;
}

/** Split faces of one cylinder (occt halves) become one feature. */
function mergeCoaxial(cyls: RawCylinder[], tol: number): RawCylinder[] {
  const out: RawCylinder[] = [];
  for (const c of [...cyls].sort((a, b) => b.area - a.area)) {
    const m = out.find(
      (o) => o.kind === c.kind && Math.abs(o.diameter - c.diameter) < tol * 2 && sameAxisLine(o, c, tol) &&
        c.extent[0] <= o.extent[1] + tol && c.extent[1] >= o.extent[0] - tol,
    );
    if (!m) {
      out.push({ ...c, faceIds: [...c.faceIds] });
      continue;
    }
    m.arc += c.arc; // halves of one cylinder don't overlap
    m.full = m.full || c.full || m.arc > FULL;
    m.extent = [Math.min(m.extent[0], c.extent[0]), Math.max(m.extent[1], c.extent[1])];
    m.area += c.area;
    m.faceIds.push(...c.faceIds);
  }
  return out;
}

/** Does a face cap one end of the bore (a drill-point cone or flat bottom)? */
function hasBottom(c: ModelCylinder, faces: Face[], tol: number): boolean {
  const ax = toV(c.axis), o = toV(c.origin);
  const r = c.diameter / 2;
  const own = new Set(c.faceIds);
  return faces.some((f) => {
    if (own.has(f.id)) return false;
    let nearEnd = false;
    for (const v of f.verts) {
      const d = sub(v, o);
      const t = dot(d, ax);
      if (Math.hypot(...sub(d, scale(ax, t))) > r + tol) return false;
      if (t < c.extent[0] - tol || t > c.extent[1] + r * 2) return false;
      if (Math.abs(t - c.extent[0]) < tol || Math.abs(t - c.extent[1]) < tol) nearEnd = true;
    }
    return nearEnd;
  });
}

function holePatterns(cyls: ModelCylinder[], tol: number): HolePattern[] {
  const groups: HolePattern[] = [];
  cyls.forEach((c, i) => {
    if (c.kind !== "bore" || !c.full) return;
    const g = groups.find(
      (h) => Math.abs(h.diameter - c.diameter) < tol * 2 && Math.abs(dot(toV(h.axis), toV(c.axis))) > 0.9999,
    );
    if (g) g.members.push(i);
    else groups.push({ axis: c.axis, diameter: c.diameter, count: 0, members: [i], thru: true, boltCircle: null, stacks: [] });
  });
  for (const g of groups) {
    g.count = g.members.length;
    g.thru = g.members.every((i) => !cyls[i].blind);
    g.boltCircle = boltCircle(g.members.map((i) => cyls[i]), tol);
  }
  return groups.sort((a, b) => b.diameter - a.diameter);
}

/**
 * Merge each pattern's coaxial members into physical holes and test whether
 * each is open through the whole part (a ray down its axis hits nothing).
 */
function holeStacks(holes: HolePattern[], cyls: ModelCylinder[], p: ArrayLike<number>, tol: number): HoleStack[] {
  const stacks: HoleStack[] = [];
  for (const h of holes) {
    for (const i of h.members) {
      const c = cyls[i];
      const s = stacks.find((st) => st.diameter === h.diameter && sameAxisLine(cyls[st.members[0]], c, tol) && Math.abs(dot(toV(st.axis), toV(c.axis))) > 0.9999);
      if (s) {
        s.members.push(i);
        s.extent = [Math.min(s.extent[0], c.extent[0]), Math.max(s.extent[1], c.extent[1])];
      } else {
        stacks.push({ axis: c.axis, center: c.origin, diameter: h.diameter, members: [i], extent: [...c.extent], throughPart: false });
      }
    }
  }
  const blocked = lineHits(p, stacks);
  stacks.forEach((s, k) => {
    s.members.sort((a, b) => cyls[a].extent[0] - cyls[b].extent[0]);
    s.throughPart = s.members.every((i) => !cyls[i].blind) && !blocked[k];
    const idx = holes.findIndex((h) => h.members.includes(s.members[0]));
    if (idx >= 0) holes[idx].stacks.push(k);
  });
  return stacks;
}

/** For each stack: does the infinite line down its axis cross any triangle? */
function lineHits(p: ArrayLike<number>, stacks: HoleStack[]): boolean[] {
  const hit = stacks.map(() => false);
  const triCount = Math.floor(p.length / 9);
  // group stacks by direction so each triangle is projected once per direction
  const byDir = new Map<string, number[]>();
  stacks.forEach((s, k) => {
    const key = [s.axis.x, s.axis.y, s.axis.z].map((v) => v.toFixed(4)).join();
    byDir.set(key, [...(byDir.get(key) ?? []), k]);
  });
  for (const ks of byDir.values()) {
    const a = toV(stacks[ks[0]].axis);
    const u = norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
    const w = cross(a, u);
    const pts = ks.map((k) => [dot(toV(stacks[k].center), u), dot(toV(stacks[k].center), w)]);
    for (let t = 0; t < triCount; t++) {
      const q = [0, 1, 2].map((j) => [p[t * 9 + j * 3], p[t * 9 + j * 3 + 1], p[t * 9 + j * 3 + 2]] as V);
      const uv = q.map((v) => [dot(v, u), dot(v, w)]);
      const area = (uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1]);
      if (Math.abs(area) < 1e-12) continue; // parallel to the line (hole walls)
      const lo0 = Math.min(uv[0][0], uv[1][0], uv[2][0]), hi0 = Math.max(uv[0][0], uv[1][0], uv[2][0]);
      const lo1 = Math.min(uv[0][1], uv[1][1], uv[2][1]), hi1 = Math.max(uv[0][1], uv[1][1], uv[2][1]);
      ks.forEach((k, j) => {
        if (hit[k]) return;
        const [x, y] = pts[j];
        if (x < lo0 || x > hi0 || y < lo1 || y > hi1) return;
        // barycentric test in the projected plane; inclusive, so a facet vertex
        // sitting exactly on the hole's axis still counts as material
        const b0 = ((uv[1][0] - x) * (uv[2][1] - y) - (uv[2][0] - x) * (uv[1][1] - y)) / area;
        const b1 = ((uv[2][0] - x) * (uv[0][1] - y) - (uv[0][0] - x) * (uv[2][1] - y)) / area;
        const b2 = 1 - b0 - b1;
        if (b0 >= -1e-9 && b1 >= -1e-9 && b2 >= -1e-9) hit[k] = true;
      });
    }
  }
  return hit;
}

/** ≥3 holes equally spaced on a circle → its center and diameter. */
function boltCircle(members: ModelCylinder[], tol: number): HolePattern["boltCircle"] {
  if (members.length < 3) return null;
  const ax = toV(members[0].axis);
  // axis points are each cylinder's origin (closest to model origin) → all on one plane ⟂ axis
  const pts = members.map((m) => toV(m.origin));
  const c = scale(pts.reduce(addv, [0, 0, 0]), 1 / pts.length);
  const radii = pts.map((p) => Math.hypot(...sub(p, c)));
  const R = radii.reduce((s, r) => s + r, 0) / radii.length;
  if (R < tol || radii.some((r) => Math.abs(r - R) > tol * 5)) return null;
  const u = norm(sub(pts[0], c));
  const w = cross(ax, u);
  const angles = pts.map((p) => Math.atan2(dot(sub(p, c), w), dot(sub(p, c), u))).sort((a, b) => a - b);
  const step = (2 * Math.PI) / pts.length;
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * Math.PI;
    if (Math.abs(next - angles[i] - step) > 0.01) return null;
  }
  return { center: vec(c), diameter: 2 * R };
}

function turnedProfile(cyls: ModelCylinder[], planes: ModelPlane[], p: ArrayLike<number>, tol: number): TurnedProfile | null {
  // the axis carrying the most cylinder area
  let best: { c: ModelCylinder; area: number } | null = null;
  for (const c of cyls) {
    const area = cyls.filter((o) => sameAxisLine(c, o, tol)).reduce((s, o) => s + o.area, 0);
    if (!best || area > best.area) best = { c, area };
  }
  if (!best) return null;
  const ax = toV(best.c.axis), o = toV(best.c.origin);
  const coax = cyls.filter((c) => sameAxisLine(best!.c, c, tol) && c.full);
  const bosses = coax.filter((c) => c.kind === "boss");
  if (bosses.length === 0) return null;
  // axisymmetric envelope: nothing sticks out past the largest OD
  const maxR = Math.max(...bosses.map((b) => b.diameter / 2));
  let t0 = Infinity, t1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const d = sub([p[i], p[i + 1], p[i + 2]], o);
    const t = dot(d, ax);
    if (Math.hypot(...sub(d, scale(ax, t))) > maxR + tol * 5) return null;
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
  }
  const steps = bosses.map((b) => ({ diameter: b.diameter, start: b.extent[0], end: b.extent[1] })).sort((a, b) => a.start - b.start);
  const grooves = steps
    .filter((s, i) => i > 0 && i < steps.length - 1 && steps[i - 1].diameter > s.diameter + tol && steps[i + 1].diameter > s.diameter + tol)
    .map((s) => ({ rootDiameter: s.diameter, start: s.start, end: s.end, width: s.end - s.start }));
  const shoulders = planes
    .filter((pl) => Math.abs(dot(toV(pl.normal), ax)) > 0.9999)
    .map((pl) => pl.offset * Math.sign(dot(toV(pl.normal), ax)) - dot(o, ax));
  const uniq: number[] = [];
  for (const s of shoulders.sort((a, b) => a - b)) if (!uniq.length || s - uniq[uniq.length - 1] > tol) uniq.push(s);
  return { axis: vec(ax), origin: vec(o), extent: [t0, t1], steps, grooves, shoulders: uniq };
}

function signedVolume(p: ArrayLike<number>): number {
  let v = 0;
  for (let i = 0; i + 8 < p.length; i += 9) {
    v += (p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) -
      p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) +
      p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6])) / 6;
  }
  return v;
}

function extentOf(p: ArrayLike<number>): number {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < p.length; i++) {
    lo = Math.min(lo, p[i]);
    hi = Math.max(hi, p[i]);
  }
  return hi - lo;
}
