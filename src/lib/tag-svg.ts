import codes from "./apriltag-36h11.json";

/**
 * AprilTag 36h11 geometry, matching how js-aruco2 reads a tag: a one-cell
 * white quiet zone, a one-cell black border, then 6×6 data cells where a 1
 * bit is a white cell, row-major from the top-left. Ids 0–586.
 */
export const TAG_FAMILY_SIZE = codes.length;
export const TAG_GRID = 10; // quiet zone + border + 6 data + border + quiet zone

/** [x, y] of every white data cell, in the 10×10 grid. */
export function tagWhiteCells(id: number): [number, number][] {
  const code = codes[id];
  if (code === undefined) throw new RangeError(`AprilTag 36h11 has no id ${id}`);
  const bits = BigInt(code).toString(2).padStart(36, "0");
  const cells: [number, number][] = [];
  for (let i = 0; i < 36; i++) {
    if (bits[i] === "1") cells.push([(i % 6) + 2, Math.floor(i / 6) + 2]);
  }
  return cells;
}

/** Standalone SVG markup for downloads and the print page. */
export function tagSvgString(id: number): string {
  const rects = tagWhiteCells(id)
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="white"/>`)
    .join("");
  return `<svg width="100%" height="100%" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TAG_GRID} ${TAG_GRID}"><rect x="0" y="0" width="${TAG_GRID}" height="${TAG_GRID}" fill="white"/><rect x="1" y="1" width="8" height="8" fill="black"/>${rects}</svg>`;
}

/** A printable label: the tag with the part name underneath, as one SVG. */
export function labelSvgString(id: number, name: string, location: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rects = tagWhiteCells(id)
    .map(([x, y]) => `<rect x="${x * 24}" y="${y * 24}" width="24" height="24" fill="white"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300" viewBox="0 0 240 300" shape-rendering="crispEdges"><rect width="240" height="300" fill="white"/><rect x="24" y="24" width="192" height="192" fill="black"/>${rects}<text x="120" y="258" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#111">${esc(name.slice(0, 32))}</text><text x="120" y="278" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="#555">${esc(location.slice(0, 44))}</text><text x="120" y="294" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#888">AprilTag 36h11 · id ${id}</text></svg>`;
}
