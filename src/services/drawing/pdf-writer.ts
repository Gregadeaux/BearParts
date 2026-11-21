import { jsPDF } from "jspdf";
import { LINE_WEIGHT_IN, type PathShape, type Sheet, type TextShape } from "./primitives";
import { CAP_HEIGHT_EM, DEPTH, DEPTH_ADVANCE_EM, DIA, DIA_ADVANCE_EM, emFor, textOrigin, textWidth } from "./text-metrics";

export interface PdfMeta {
  title: string;
  author?: string;
  subject?: string;
}

/**
 * Write a Sheet as a vector PDF (letter landscape, inch units). The only
 * module that touches jsPDF — everything else builds plain shapes.
 */
export function sheetToPdf(sheet: Sheet, meta: PdfMeta): ArrayBuffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "in", format: "letter", compress: true });
  doc.setProperties({
    title: meta.title,
    author: meta.author ?? "",
    subject: meta.subject ?? "Dimensioned drawing",
    creator: "BearParts",
  });
  doc.setDrawColor("#000000");
  doc.setFillColor("#000000");
  doc.setTextColor("#000000");
  doc.setLineJoin("round");
  doc.setLineCap("round");

  const flipY = (y: number) => sheet.height - y;
  for (const s of sheet.shapes) {
    if (s.kind === "path") drawPath(doc, s, flipY);
    else drawText(doc, s, flipY);
  }
  return doc.output("arraybuffer");
}

function drawPath(doc: jsPDF, s: PathShape, flipY: (y: number) => number) {
  if (s.cmds.length < 2) return;
  doc.setLineWidth(LINE_WEIGHT_IN[s.weight]);
  for (const c of s.cmds) {
    if (c.op === "M") doc.moveTo(c.p.x, flipY(c.p.y));
    else if (c.op === "L") doc.lineTo(c.p.x, flipY(c.p.y));
    else if (c.op === "C") {
      doc.curveTo(c.c1.x, flipY(c.c1.y), c.c2.x, flipY(c.c2.y), c.p.x, flipY(c.p.y));
    } else doc.close();
  }
  if (s.fill) doc.fill();
  else doc.stroke();
}

/**
 * Text in runs: standard-font glyphs via doc.text, the ⌀ symbol as vector
 * strokes (no standard PDF font has it). Positions come from the same width
 * table layout used, so alignment matches exactly.
 */
function drawText(doc: jsPDF, t: TextShape, flipY: (y: number) => number) {
  const em = emFor(t.size);
  doc.setFont("helvetica", t.bold ? "bold" : "normal");
  doc.setFontSize(em * 72);
  const o = textOrigin(t);
  let advance = 0;
  // split around the vector-drawn symbols, keeping them as their own tokens
  for (const run of t.text.split(new RegExp(`(${DIA}|${DEPTH})`))) {
    if (run === DIA) {
      diameterGlyph(doc, o, advance, t.size, flipY);
      advance += DIA_ADVANCE_EM * em;
    } else if (run === DEPTH) {
      depthGlyph(doc, o, advance, t.size, flipY);
      advance += DEPTH_ADVANCE_EM * em;
    } else if (run) {
      const x = o.x + o.dx * advance;
      const y = o.y + o.dy * advance;
      doc.text(run, x, flipY(y), { angle: t.rotate ?? 0, baseline: "alphabetic" });
      advance += textWidth(run, t.size, t.bold);
    }
  }
}

/** ASME depth symbol: a down arrow onto a short bar. */
function depthGlyph(
  doc: jsPDF,
  o: { x: number; y: number; dx: number; dy: number },
  at: number,
  h: number,
  flipY: (y: number) => number,
) {
  const toSheet = (u: number, v: number) => ({
    x: o.x + o.dx * (at + u) - o.dy * v,
    y: o.y + o.dy * (at + u) + o.dx * v,
  });
  const cu = (DEPTH_ADVANCE_EM / CAP_HEIGHT_EM) * h * 0.5;
  doc.setLineWidth(h * 0.1);
  const seg = (u0: number, v0: number, u1: number, v1: number) => {
    const a = toSheet(u0, v0), b = toSheet(u1, v1);
    doc.line(a.x, flipY(a.y), b.x, flipY(b.y));
  };
  seg(cu, h, cu, 0); // stem
  seg(cu - h * 0.25, h * 0.32, cu, 0); // arrow
  seg(cu + h * 0.25, h * 0.32, cu, 0);
  seg(cu - h * 0.4, 0, cu + h * 0.4, 0); // bar
}

/** ASME diameter symbol: circle ≈ cap height with a 60° slash through it. */
function diameterGlyph(
  doc: jsPDF,
  o: { x: number; y: number; dx: number; dy: number },
  at: number,
  h: number,
  flipY: (y: number) => number,
) {
  // local frame: u along the baseline, v up the glyph
  const toSheet = (u: number, v: number) => ({
    x: o.x + o.dx * (at + u) - o.dy * v,
    y: o.y + o.dy * (at + u) + o.dx * v,
  });
  const cu = (DIA_ADVANCE_EM / CAP_HEIGHT_EM) * h * 0.5;
  const cv = h * 0.5;
  const r = h * 0.46;
  doc.setLineWidth(h * 0.1);
  const c = toSheet(cu, cv);
  doc.circle(c.x, flipY(c.y), r, "S");
  const reach = h * 0.68;
  const a = toSheet(cu - reach * Math.cos(Math.PI / 3), cv - reach * Math.sin(Math.PI / 3));
  const b = toSheet(cu + reach * Math.cos(Math.PI / 3), cv + reach * Math.sin(Math.PI / 3));
  doc.line(a.x, flipY(a.y), b.x, flipY(b.y));
}
