/**
 * 3D verify figure (STEP/STL): aim an orthographic camera so the measured
 * model axis reads true length, and place the dimension line. Pure; units are
 * the raw mesh units. Hole steps use `boreView` (bore-view.ts) instead.
 */

export type Axis = "x" | "y" | "z";
export type Vec3 = [number, number, number];
type Size = { x: number; y: number; z: number };

export interface ModelView {
  /** axis drawn left→right on screen */
  horizontal: Axis;
  /** axis drawn bottom→top on screen */
  up: Axis;
  /** axis we look along (the smallest extent of the two not being measured) */
  side: Axis;
  /** unit vector from the model center toward the camera */
  cameraDir: Vec3;
  /** camera up vector */
  upVec: Vec3;
  /** is the measured axis horizontal or vertical on screen */
  dimOnScreen: "horizontal" | "vertical";
}

const AXES: Axis[] = ["x", "y", "z"];
const unit = (axis: Axis, s = 1): Vec3 => AXES.map((a) => (a === axis ? s : 0)) as Vec3;
/**
 * Turn the camera this far off the face to show some depth. The turn is
 * always ABOUT the measured axis, so that axis stays exactly parallel to the
 * screen and exactly horizontal/vertical — true length, no skew.
 */
const TURN = (20 * Math.PI) / 180;

/**
 * Aim the camera so `axis` is parallel to the screen: look at the largest
 * face that contains it, with the longer visible axis horizontal (the
 * figure is wide and short).
 */
export function modelView(size: Size, axis: Axis): ModelView {
  const others = AXES.filter((a) => a !== axis);
  const side = size[others[0]] <= size[others[1]] ? others[0] : others[1];
  const remaining = others.find((a) => a !== side)!;
  const horizontal = size[axis] >= size[remaining] ? axis : remaining;
  const up = horizontal === axis ? remaining : axis;
  // top views come from +z, front views from −y, side views from +x
  const sideSign = side === "y" ? -1 : 1;
  // lean toward whichever visible axis is NOT the one being measured
  const lean = horizontal === axis ? up : horizontal;
  const dir = [0, 1, 2].map(
    (i) => unit(side, sideSign)[i] * Math.cos(TURN) + unit(lean)[i] * Math.sin(TURN),
  ) as Vec3;
  return {
    horizontal,
    up,
    side,
    cameraDir: dir,
    upVec: unit(up),
    dimOnScreen: horizontal === axis ? "horizontal" : "vertical",
  };
}

export interface DimensionLine3D {
  a: Vec3;
  b: Vec3;
  extA: [Vec3, Vec3];
  extB: [Vec3, Vec3];
  mid: Vec3;
}

/**
 * Dimension line along `axis` for a box centered at the origin: below the
 * model when the dimension is horizontal on screen, left of it when vertical,
 * on the face toward the camera so the model never hides it.
 */
export function modelDimensionLine(
  size: Size,
  axis: Axis,
  view: ModelView,
  gap: number,
  overshoot: number,
  /** close-ups: run the extension lines in to here (across-axis coordinate) so they meet visible material */
  extendTo?: number,
): DimensionLine3D {
  const half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
  const across: Axis = view.dimOnScreen === "horizontal" ? view.up : view.horizontal;
  const sideSign = view.side === "y" ? -1 : 1;
  const at = (alongAxis: number, acrossValue: number): Vec3 => {
    const p: Vec3 = [0, 0, 0];
    p[AXES.indexOf(axis)] = alongAxis;
    p[AXES.indexOf(across)] = acrossValue;
    p[AXES.indexOf(view.side)] = sideSign * half[view.side];
    return p;
  };
  const line = -(half[across] + gap);
  const edge = extendTo ?? -half[across];
  const tail = line - overshoot;
  return {
    a: at(-half[axis], line),
    b: at(half[axis], line),
    extA: [at(-half[axis], edge), at(-half[axis], tail)],
    extB: [at(half[axis], edge), at(half[axis], tail)],
    mid: at(0, line),
  };
}

/** Screen-space extents (model units) of the turned view, padded by `margin`. */
export function viewExtents(size: Size, view: ModelView, margin: number): { width: number; height: number } {
  const turn = (along: number) => along * Math.cos(TURN) + size[view.side] * Math.sin(TURN);
  const horizontalDim = view.dimOnScreen === "horizontal";
  return {
    width: (horizontalDim ? size[view.horizontal] : turn(size[view.horizontal])) + 2 * margin,
    height: (horizontalDim ? turn(size[view.up]) : size[view.up]) + 2 * margin,
  };
}

export interface ModelFraming {
  /** orthographic zoom: screen px per model unit */
  zoom: number;
  /** point the camera looks at (model is centered on the origin) */
  target: Vec3;
  /** true when zoomed in on one end because the dimension was too small to see */
  closeUp: boolean;
}

/** a dimension shorter than this on screen gets a close-up instead */
export const MIN_DIM_PX = 28;

/**
 * Fit the whole model — unless the measured extent would be a sliver (a
 * 0.125" plate edge on a 29" plate is ~1px). Then zoom so it fills about
 * half the figure height and look at the end of the part where the
 * dimension line sits, line near the left edge, part filling the rest.
 */
export function modelFraming(
  size: Size,
  axis: Axis,
  view: ModelView,
  px: { width: number; height: number },
  padPx: number,
): ModelFraming {
  const ext = viewExtents(size, view, 0);
  const fit = Math.max(
    Math.min((px.width - 2 * padPx) / ext.width, (px.height - 2 * padPx) / ext.height),
    1e-6,
  );
  if (size[axis] * fit >= MIN_DIM_PX || view.dimOnScreen === "horizontal") {
    return { zoom: fit, target: [0, 0, 0], closeUp: false };
  }
  const zoom = ((px.height - 2 * padPx) * 0.5) / Math.max(size[axis], 1e-6);
  const target: Vec3 = [0, 0, 0];
  const h = AXES.indexOf(view.horizontal);
  // dimension line sits left of the model (see modelDimensionLine); keep it ~48px in
  target[h] = -size[view.horizontal] / 2 + (px.width / 2 - 48) / zoom;
  target[AXES.indexOf(view.side)] = (view.side === "y" ? -1 : 1) * (size[view.side] / 2);
  return { zoom, target, closeUp: true };
}
