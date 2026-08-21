import { buildDxf } from "./dxf-builder";
import { MOCK_STEP_BASE64 } from "./fixtures/mock-step";
import { MOCK_PREVIEW_PNG_BASE64 } from "./fixtures/mock-preview";
import type {
  DxfExportResponse,
  FacesResponse,
  PlanarFace,
  StudioContextResponse,
} from "./types";

/**
 * Canned Onshape backend for ONSHAPE_MOCK=1 — lets the panel run end to end
 * (context → faces → export → import) without credentials or API calls.
 */

export function mockStudioContext(): StudioContextResponse {
  return {
    documentName: "2027 Robot — Drivetrain",
    elementName: "Gearbox Plates",
    parts: [
      { partId: "JHD", name: "Second Gear Plate", material: "Aluminum 6061" },
      { partId: "JHK", name: "Bearing Spacer", material: "Aluminum 7075" },
      { partId: "JHL", name: "Motor Mount", material: null },
    ],
  };
}

const MOCK_FACES: PlanarFace[] = [
  { faceId: "F1", width: 9.163, height: 4.592, area: 42.07 },
  { faceId: "F2", width: 9.163, height: 0.25, area: 2.29 },
  { faceId: "F3", width: 4.592, height: 0.25, area: 1.15 },
];

export function mockFaces(): FacesResponse {
  return { faces: MOCK_FACES };
}

/** Plate with rounded corners and a bolt circle, matching MOCK_FACES[0]. */
export function mockDxfExport(faceId: string): DxfExportResponse {
  const face = MOCK_FACES.find((f) => f.faceId === faceId) ?? MOCK_FACES[0];
  const { width: w, height: h } = face;
  const r = Math.min(0.5, h / 4);
  return {
    dxf: buildDxf([
      { kind: "line", x1: r, y1: 0, x2: w - r, y2: 0 },
      { kind: "arc", cx: w - r, cy: r, r, startDeg: 270, endDeg: 360 },
      { kind: "line", x1: w, y1: r, x2: w, y2: h - r },
      { kind: "arc", cx: w - r, cy: h - r, r, startDeg: 0, endDeg: 90 },
      { kind: "line", x1: w - r, y1: h, x2: r, y2: h },
      { kind: "arc", cx: r, cy: h - r, r, startDeg: 90, endDeg: 180 },
      { kind: "line", x1: 0, y1: h - r, x2: 0, y2: r },
      { kind: "arc", cx: r, cy: r, r, startDeg: 180, endDeg: 270 },
      { kind: "circle", cx: w / 2, cy: h / 2, r: 0.5 },
      ...[45, 135, 225, 315].map((deg) => ({
        kind: "circle" as const,
        cx: w / 2 + Math.cos((deg * Math.PI) / 180) * 1.25,
        cy: h / 2 + Math.sin((deg * Math.PI) / 180) * 1.25,
        r: 0.098, // #10 clearance
      })),
    ]),
    envelope: { width: w, height: h },
  };
}

export function mockStepBytes(): Uint8Array {
  return Uint8Array.from(atob(MOCK_STEP_BASE64), (c) => c.charCodeAt(0));
}

export function mockPreviewPng(): Uint8Array {
  return Uint8Array.from(atob(MOCK_PREVIEW_PNG_BASE64), (c) => c.charCodeAt(0));
}
