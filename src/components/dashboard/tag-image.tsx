import { TAG_GRID, tagWhiteCells } from "@/lib/tag-svg";

/** An AprilTag drawn inline. Keep the white border: it is part of the marker. */
export default function TagImage({ id, className, title }: { id: number; className?: string; title?: string }) {
  return (
    <svg viewBox={`0 0 ${TAG_GRID} ${TAG_GRID}`} shapeRendering="crispEdges" className={className} role="img" aria-label={title ?? `AprilTag ${id}`}>
      <rect x="0" y="0" width={TAG_GRID} height={TAG_GRID} fill="white" />
      <rect x="1" y="1" width="8" height="8" fill="black" />
      {tagWhiteCells(id).map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="white" />)}
    </svg>
  );
}
