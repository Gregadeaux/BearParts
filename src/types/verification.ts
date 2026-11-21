import type { Database } from "./database";
import type { ProfileRow } from "./part";
import type { KeyDimension } from "@/services/dimensions/key-dimensions";

export type VerificationRow = Database["public"]["Tables"]["part_verifications"]["Row"];

/** pass = every dimension measured and in tolerance; any skip = incomplete; any miss = fail. */
export type VerificationResult = "pass" | "fail" | "incomplete";

/** One key dimension as recorded in a check. `measured: null` = skipped. */
export interface MeasuredDimension extends KeyDimension {
  measured: number | null;
  /** measured − nominal, inches; null when skipped */
  deviation: number | null;
  pass: boolean | null;
  /** changed after the nominal was revealed on the summary (entry is blind until then) */
  revised?: boolean;
  /** with `revised`: the reading entered before the reveal (null = it was skipped) */
  firstMeasured?: number | null;
}

/** An immutable verification record with its typed measurements and who took them. */
export interface PartVerification extends Omit<VerificationRow, "dimensions" | "result"> {
  dimensions: MeasuredDimension[];
  result: VerificationResult;
  verifier: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}
