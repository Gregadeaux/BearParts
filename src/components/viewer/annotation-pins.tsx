"use client";

export interface ViewerAnnotation {
  id: string;
  x: number;
  y: number;
  /** displayed number inside the pin */
  index: number;
}

interface Props {
  annotations: ViewerAnnotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  unitsPerPx: number;
  /** not-yet-saved pin being composed */
  draft?: { x: number; y: number } | null;
}

/** Numbered comment pins over the drawing (flipped-Y viewer space). */
export function AnnotationPins({ annotations, selectedId, onSelect, unitsPerPx, draft }: Props) {
  const r = 9 * unitsPerPx;
  return (
    <g>
      {annotations.map((a) => {
        const selected = a.id === selectedId;
        return (
          <g
            key={a.id}
            transform={`translate(${a.x} ${-a.y})`}
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(a.id);
            }}
          >
            <circle
              r={r}
              fill={selected ? "#d97706" : "#f59e0b"}
              stroke="#ffffff"
              strokeWidth={1.5 * unitsPerPx}
              opacity={selected ? 1 : 0.9}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={11 * unitsPerPx}
              fontWeight={600}
              style={{ userSelect: "none" }}
            >
              {a.index}
            </text>
          </g>
        );
      })}
      {draft && (
        <g transform={`translate(${draft.x} ${-draft.y})`}>
          <circle
            r={r}
            fill="#d97706"
            fillOpacity={0.35}
            stroke="#d97706"
            strokeWidth={1.5 * unitsPerPx}
            strokeDasharray={`${3 * unitsPerPx} ${2 * unitsPerPx}`}
          />
        </g>
      )}
    </g>
  );
}
