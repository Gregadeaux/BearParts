export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  min: Point;
  max: Point;
  width: number;
  height: number;
}

/** A line or arc segment, the building blocks of loops. */
export type Segment =
  | { kind: "line"; a: Point; b: Point }
  | {
      kind: "arc";
      a: Point;
      b: Point;
      center: Point;
      radius: number;
      /** true if the arc travels counter-clockwise from a to b */
      ccw: boolean;
    };

/** A closed chain of segments. */
export interface Loop {
  segments: Segment[];
  /** signed area; positive = counter-clockwise */
  area: number;
}

/** Normalized, transform-applied entities extracted from a DXF (units already in inches when known). */
export type NormalizedEntity =
  | { kind: "line"; a: Point; b: Point }
  | { kind: "circle"; center: Point; radius: number }
  | {
      kind: "arc";
      center: Point;
      radius: number;
      /** radians */
      startAngle: number;
      /** radians */
      endAngle: number;
    }
  | {
      kind: "polyline";
      vertices: { x: number; y: number; bulge: number }[];
      closed: boolean;
    }
  | { kind: "path"; points: Point[]; closed: boolean };
