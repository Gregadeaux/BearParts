"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { StlMesh } from "@/services/stl/stl-parser";
import { Skeleton } from "@/components/ui/skeleton";

// same lazy three.js viewer the STL workspace uses
const StlViewer = dynamic(() => import("./stl-viewer").then((m) => m.StlViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[55svh] min-h-64 w-full lg:h-[60svh]" />,
});

/** 3D preview for STEP models — OpenCascade tessellates, the STL viewer renders. */
export function StepWorkspace({ stepBuffer }: { stepBuffer: ArrayBuffer }) {
  const [state, setState] = useState<{ mesh: StlMesh | null; error: string | null }>({
    mesh: null,
    error: null,
  });

  useEffect(() => {
    let stale = false;
    import("@/services/step/step-parser")
      .then(({ parseStep }) => parseStep(stepBuffer))
      .then((mesh) => !stale && setState({ mesh, error: null }))
      .catch(
        (e) =>
          !stale &&
          setState({
            mesh: null,
            error: e instanceof Error ? e.message : "Could not read this STEP file",
          }),
      );
    return () => {
      stale = true;
    };
  }, [stepBuffer]);

  if (state.error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        {state.error}
      </div>
    );
  }
  if (!state.mesh) {
    return <Skeleton className="h-[55svh] min-h-64 w-full lg:h-[60svh]" />;
  }
  return <StlViewer mesh={state.mesh} className="h-[55svh] min-h-64 lg:h-[60svh]" />;
}
