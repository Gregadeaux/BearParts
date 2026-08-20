"use client";

import { Circle, Expand, MapPin, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  markersVisible: boolean;
  onToggleMarkers: () => void;
  /** undefined hides the annotate tool entirely */
  annotating?: boolean;
  onToggleAnnotate?: () => void;
}

export function ViewerToolbar({
  onZoomIn,
  onZoomOut,
  onFit,
  markersVisible,
  onToggleMarkers,
  annotating,
  onToggleAnnotate,
}: Props) {
  return (
    <div className="absolute right-2 top-2 flex flex-col gap-1">
      <Button variant="secondary" size="icon" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn}>
        <Plus />
      </Button>
      <Button variant="secondary" size="icon" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut}>
        <Minus />
      </Button>
      <Button variant="secondary" size="icon" aria-label="Fit to view" title="Fit to view" onClick={onFit}>
        <Expand />
      </Button>
      <Button
        variant={markersVisible ? "default" : "secondary"}
        size="icon"
        aria-label={markersVisible ? "Hide hole markers" : "Show hole markers"}
        title={markersVisible ? "Hide hole markers" : "Show hole markers"}
        onClick={onToggleMarkers}
      >
        <Circle />
      </Button>
      {onToggleAnnotate && (
        <Button
          variant={annotating ? "default" : "secondary"}
          size="icon"
          aria-label="Pin a comment"
          title="Pin a comment"
          onClick={onToggleAnnotate}
        >
          <MapPin />
        </Button>
      )}
    </div>
  );
}
