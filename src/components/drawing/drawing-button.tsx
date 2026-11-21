"use client";

import type { DrawingSource } from "@/types/drawing";
import { DrawingDialog } from "./drawing-dialog";

/**
 * "Drawing" button: generates a dimensioned drawing PDF of the part in the
 * browser. PDF parts already are drawings, so they get nothing.
 */
export function DrawingButton({
  source,
  size = "sm",
}: {
  source: DrawingSource;
  size?: "sm" | "default";
}): React.JSX.Element | null {
  if (source.fileType === "pdf") return null;
  return <DrawingDialog source={source} size={size} />;
}
