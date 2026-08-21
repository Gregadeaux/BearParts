import { Suspense } from "react";
import { PanelApp } from "@/components/onshape/panel-app";

export const metadata = { title: "BearParts for Onshape" };

/**
 * The Onshape right-panel extension. Public route (no cookie auth — this runs
 * in a third-party iframe); the panel signs in via popup + Bearer tokens.
 */
export default function OnshapePanelPage() {
  return (
    <Suspense>
      <PanelApp />
    </Suspense>
  );
}
