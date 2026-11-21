import type { DxfAnalysis, Units } from "./analysis";
import type { PartFileType } from "./part";

/** Everything the drawing generator needs to know about one part file. */
export interface DrawingSource {
  name: string;
  /** storage path in the part-files bucket */
  filePath: string;
  fileType: PartFileType;
  units: Units;
  analysis: DxfAnalysis | null;
  material: string | null;
  /** saved stock thickness, inches */
  thicknessIn: number | null;
  quantity: number | null;
  drafter: string | null;
  revision: string | null;
  /**
   * Absolute link to the part's page (library part when it has one, else the
   * queue part) — printed as a QR code on the sheet. No QR when absent.
   */
  url?: string | null;
}
