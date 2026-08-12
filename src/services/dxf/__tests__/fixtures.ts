/** Minimal DXF text builder for tests — emits R12-style ENTITIES sections. */

export function dxf(opts: { insunits?: number; entities: string[] }): string {
  const header = opts.insunits
    ? ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(opts.insunits), "0", "ENDSEC"]
    : [];
  return [
    ...header,
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    ...opts.entities.flatMap((e) => e.trim().split(/\r?\n/)),
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ].join("\n");
}

export const circle = (x: number, y: number, r: number) => `
0
CIRCLE
8
0
10
${x}
20
${y}
40
${r}`;

export const line = (x1: number, y1: number, x2: number, y2: number) => `
0
LINE
8
0
10
${x1}
20
${y1}
11
${x2}
21
${y2}`;

export const arc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => `
0
ARC
8
0
10
${cx}
20
${cy}
40
${r}
50
${startDeg}
51
${endDeg}`;

/** Closed LWPOLYLINE; vertices as [x, y, bulge?] */
export const lwpolyline = (vertices: [number, number, number?][], closed = true) => `
0
LWPOLYLINE
8
0
90
${vertices.length}
70
${closed ? 1 : 0}
${vertices
  .map(([x, y, bulge]) => `10\n${x}\n20\n${y}${bulge ? `\n42\n${bulge}` : ""}`)
  .join("\n")}`;

/**
 * A rectangle with filleted corners as an LWPOLYLINE.
 * Fillet bulge for a 90° corner arc = tan(90°/4) ≈ 0.4142.
 */
export function filletedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const b = Math.tan(Math.PI / 8); // 90° fillet
  return lwpolyline([
    [x + r, y, 0],
    [x + w - r, y, b],
    [x + w, y + r, 0],
    [x + w, y + h - r, b],
    [x + w - r, y + h, 0],
    [x + r, y + h, b],
    [x, y + h - r, 0],
    [x, y + r, b],
  ]);
}

export const rect = (x: number, y: number, w: number, h: number) =>
  lwpolyline([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
