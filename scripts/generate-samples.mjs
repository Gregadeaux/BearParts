/* Emits sample DXF files into samples/. Run: node scripts/generate-samples.mjs */
import { mkdir, writeFile } from "node:fs/promises";

const g = (code, value) => `${code}\n${value}`;
const circle = (x, y, r) => ["0\nCIRCLE\n8\n0", g(10, x), g(20, y), g(40, r)].join("\n");
const lwpoly = (verts, closed = true) =>
  [
    "0\nLWPOLYLINE\n8\n0",
    g(90, verts.length),
    g(70, closed ? 1 : 0),
    ...verts.map(([x, y, b]) => [g(10, x), g(20, y), ...(b ? [g(42, b)] : [])].join("\n")),
  ].join("\n");

const dxf = (insunits, entities) =>
  [
    "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70",
    String(insunits),
    "0\nENDSEC",
    "0\nSECTION\n2\nENTITIES",
    ...entities,
    "0\nENDSEC\n0\nEOF",
  ].join("\n");

const B = Math.tan(Math.PI / 8); // 90° fillet bulge

const filletRect = (x, y, w, h, r) =>
  lwpoly([
    [x + r, y, 0],
    [x + w - r, y, B],
    [x + w, y + r, 0],
    [x + w, y + h - r, B],
    [x + w - r, y + h, 0],
    [x + r, y + h, B],
    [x, y + h - r, 0],
    [x, y + r, B],
  ]);

// --- sample 1: swerve bearing plate (inches) ---
const bearingPlate = dxf(1, [
  filletRect(0, 0, 6, 3, 0.25), // outer profile, rounded corners
  circle(3, 1.5, 1.125 / 2), // center bearing bore
  circle(0.375, 0.375, 0.159 / 2), // 10-32 taps in each corner
  circle(5.625, 0.375, 0.159 / 2),
  circle(0.375, 2.625, 0.159 / 2),
  circle(5.625, 2.625, 0.159 / 2),
  circle(1.5, 1.5, 0.196 / 2), // #10 close fit pair
  circle(4.5, 1.5, 0.196 / 2),
  filletRect(0.75, 0.75, 1.0, 0.5, 0.125), // weight-saving pocket, 1/4" endmill max
  filletRect(4.25, 0.75, 1.0, 0.5, 0.125),
]);

// --- sample 2: gusset in millimeters, no header units (tests heuristic) ---
const gussetMm = [
  "0\nSECTION\n2\nENTITIES",
  lwpoly([
    [0, 0],
    [76.2, 0],
    [0, 76.2],
  ]),
  circle(15, 15, 5.106 / 2), // #10 free fit (0.201")
  circle(35, 15, 5.106 / 2),
  circle(15, 35, 5.106 / 2),
  "0\nENDSEC\n0\nEOF",
].join("\n");

// --- sample 3: plate with a sharp-cornered pocket (should warn) ---
const sharpPocket = dxf(1, [
  lwpoly([
    [0, 0],
    [4, 0],
    [4, 2],
    [0, 2],
  ]),
  lwpoly([
    [1, 0.5],
    [3, 0.5],
    [3, 1.5],
    [1, 1.5],
  ]),
  circle(0.5, 1, 0.257 / 2), // 1/4" close fit
  circle(3.5, 1, 0.266 / 2), // 1/4" free fit
]);

await mkdir("samples", { recursive: true });
await writeFile("samples/bearing-plate.dxf", bearingPlate);
await writeFile("samples/gusset-mm.dxf", gussetMm);
await writeFile("samples/sharp-pocket.dxf", sharpPocket);
console.log("samples written");
