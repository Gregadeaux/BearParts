import type { Point } from "@/types/geometry";
import { arrowHead, holeRingRadius } from "@/services/dimensions/figure";

const pts = (ps: Point[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

interface Props {
  /** spacing: first hole center; edge: the point on the datum edge */
  a: Point;
  /** spacing: the adjacent hole center; edge: the hole center */
  b: Point;
  ends: "holes" | "edge";
  /** the datum edge, drawn bold (edge distance only) */
  edge: [Point, Point] | null;
  diameter: number;
  /** world units per screen px */
  upp: number;
}

/**
 * A pattern distance, drawn in CAD coordinates (inside the y-flip group):
 * the hole(s) ringed, the datum edge bold, and a double arrow between the
 * centers (or edge → center). No numbers — entry is blind.
 */
export function DxfSpanMarks({ a, b, ends, edge, diameter, upp }: Props) {
  const r = holeRingRadius(diameter, upp);
  const ring = (c: Point, key: string) => (
    <g key={key}>
      <circle cx={c.x} cy={c.y} r={r + 4 * upp} fill="currentColor" opacity={0.15} />
      <circle cx={c.x} cy={c.y} r={r} fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={2 * upp} />
    </g>
  );
  return (
    <g className="text-blue-600 dark:text-blue-400">
      {edge && (
        <line
          x1={edge[0].x}
          y1={edge[0].y}
          x2={edge[1].x}
          y2={edge[1].y}
          stroke="currentColor"
          strokeWidth={4 * upp}
          strokeLinecap="round"
        />
      )}
      {ends === "holes" ? [ring(a, "a"), ring(b, "b")] : ring(b, "b")}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth={2 * upp} />
      <polygon points={pts(arrowHead(b, a, 8 * upp, 3.5 * upp))} fill="currentColor" />
      <polygon points={pts(arrowHead(a, b, 8 * upp, 3.5 * upp))} fill="currentColor" />
    </g>
  );
}
