/**
 * Minimal R12 DXF writer for face exports from Onshape. The panel evaluates
 * FeatureScript to pull a planar face's edges into 2D face-local coordinates,
 * then this builder turns them into a DXF our own analyzer can read
 * (LINE / ARC / CIRCLE / LWPOLYLINE, header $INSUNITS).
 */

export type DxfEntity =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  /** counter-clockwise sweep from startDeg to endDeg, degrees */
  | { kind: "arc"; cx: number; cy: number; r: number; startDeg: number; endDeg: number }
  | { kind: "polyline"; points: [number, number][]; closed: boolean };

/** Trim float noise without losing real precision. */
const fmt = (v: number) => String(Number(v.toFixed(8)));

function entityLines(e: DxfEntity): string[] {
  switch (e.kind) {
    case "line":
      return ["0", "LINE", "8", "0", "10", fmt(e.x1), "20", fmt(e.y1), "11", fmt(e.x2), "21", fmt(e.y2)];
    case "circle":
      return ["0", "CIRCLE", "8", "0", "10", fmt(e.cx), "20", fmt(e.cy), "40", fmt(e.r)];
    case "arc":
      return [
        "0", "ARC", "8", "0",
        "10", fmt(e.cx), "20", fmt(e.cy), "40", fmt(e.r),
        "50", fmt(e.startDeg), "51", fmt(e.endDeg),
      ];
    case "polyline":
      return [
        "0", "LWPOLYLINE", "8", "0",
        "90", String(e.points.length),
        "70", e.closed ? "1" : "0",
        ...e.points.flatMap(([x, y]) => ["10", fmt(x), "20", fmt(y)]),
      ];
  }
}

/** Build DXF text. insunits: 1 = inches, 4 = mm. */
export function buildDxf(entities: DxfEntity[], insunits: 1 | 4 = 1): string {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$INSUNITS", "70", String(insunits),
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entities.flatMap(entityLines),
    "0", "ENDSEC",
    "0", "EOF",
    "",
  ].join("\r\n");
}
