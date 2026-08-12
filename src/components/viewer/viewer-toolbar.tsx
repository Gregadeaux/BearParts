"use client";

import { Button } from "@/components/ui/button";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  markersVisible: boolean;
  onToggleMarkers: () => void;
}

export function ViewerToolbar({ onZoomIn, onZoomOut, onFit, markersVisible, onToggleMarkers }: Props) {
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-1">
      <Button variant="secondary" size="icon" aria-label="Zoom in" onClick={onZoomIn}>
        +
      </Button>
      <Button variant="secondary" size="icon" aria-label="Zoom out" onClick={onZoomOut}>
        −
      </Button>
      <Button variant="secondary" size="icon" aria-label="Fit to view" onClick={onFit}>
        ⤢
      </Button>
      <Button
        variant={markersVisible ? "default" : "secondary"}
        size="icon"
        aria-label="Toggle hole markers"
        onClick={onToggleMarkers}
      >
        ◎
      </Button>
    </div>
  );
}
