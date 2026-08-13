import type { DxfAnalysis, Units } from "@/types/analysis";
import type { NormalizedEntity } from "@/types/geometry";
import { parseDxf } from "./dxf-document";
import { detectUnits } from "./units.service";
import { buildLoops } from "./loop-builder";
import { findHoles, groupHoles } from "./hole-analysis.service";
import { analyzePockets, overallMaxEndmill } from "./pocket-analysis.service";
import { planEndmills } from "./endmill.service";
import { entitiesBBox, scaleEntity } from "./render.service";

export interface AnalyzedDxf {
  analysis: DxfAnalysis;
  /** entities scaled to inches — feed these to the viewer */
  entities: NormalizedEntity[];
}

/**
 * Facade: parse DXF text, detect units, and run every analyzer.
 * Pure and synchronous — runs identically in browser and on the server.
 *
 * @param unitOverride force units instead of auto-detecting (user said "this is mm")
 */
export function analyzeDxfText(text: string, unitOverride?: Units): AnalyzedDxf {
  const doc = parseDxf(text);
  const warnings = [...doc.warnings];

  let units: Units;
  let scaleToInch: number;
  let source: DxfAnalysis["unitsSource"];

  if (unitOverride && unitOverride !== "unknown") {
    units = unitOverride;
    scaleToInch = unitOverride === "mm" ? 1 / 25.4 : 1;
    source = "header";
  } else {
    const detected = detectUnits(doc.entities, doc.headerUnits);
    units = detected.units;
    scaleToInch = detected.scaleToInch;
    source = detected.source;
    if (source === "heuristic") {
      warnings.push(`Units not declared in file — guessed ${units === "mm" ? "millimeters" : "inches"} from geometry.`);
    } else if (source === "assumed") {
      warnings.push("Units could not be determined — assuming inches. Override if wrong.");
    }
  }

  const entities = doc.entities.map((e) => scaleEntity(e, scaleToInch));
  const loops = buildLoops(entities);
  const holes = findHoles(entities, loops);
  const pockets = analyzePockets(loops);
  const { maxEndmillDiameter, sharpCornerCount } = overallMaxEndmill(pockets);
  const endmills = planEndmills(holes, pockets);

  if ((holes.length > 0 || maxEndmillDiameter !== null) && !endmills.single) {
    warnings.push("Some feature is smaller than a 1mm endmill — check the tiniest holes.");
  }

  if (sharpCornerCount > 0) {
    warnings.push(
      `${sharpCornerCount} sharp internal corner${sharpCornerCount === 1 ? "" : "s"} — an endmill can't cut these exactly; add fillets or corner relief.`,
    );
  }

  return {
    entities,
    analysis: {
      units,
      unitsSource: source,
      boundingBox: entitiesBBox(entities),
      holes,
      holeGroups: groupHoles(holes),
      pockets,
      maxEndmillDiameter,
      endmills,
      sharpCornerCount,
      entityCounts: doc.entityCounts,
      warnings,
    },
  };
}
