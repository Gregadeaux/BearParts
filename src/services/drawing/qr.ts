import qrcode from "qrcode-generator";

/** Light modules required around the symbol (ISO/IEC 18004 quiet zone). */
export const QR_QUIET_MODULES = 4;

/** QR modules for `text` (error correction M, smallest version that fits). true = dark. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export interface ModuleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Filled rectangles for the dark modules, one per horizontal run, in sheet
 * coordinates (y up). `size` is the full square including the quiet zone,
 * placed with its lower-left corner at (x, y); row 0 is the top row.
 */
export function qrRects(m: boolean[][], x: number, y: number, size: number): ModuleRect[] {
  const n = m.length;
  const cell = size / (n + 2 * QR_QUIET_MODULES);
  const out: ModuleRect[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!m[r][c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && m[r][c]) c++;
      out.push({
        x: x + (QR_QUIET_MODULES + start) * cell,
        y: y + size - (QR_QUIET_MODULES + r + 1) * cell,
        w: (c - start) * cell,
        h: cell,
      });
    }
  }
  return out;
}
