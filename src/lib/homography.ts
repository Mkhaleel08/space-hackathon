/**
 * Plane math for the live view. A QR code's four corners define a plane in the
 * scene; a homography maps that plane to the screen, so a flat panel laid out
 * next to the code in "marker units" can be drawn with CSS matrix3d as if it
 * were lying on the same surface.
 */

export type Pt = { x: number; y: number };
/** Four corners, clockwise from top-left. */
export type Quad = [Pt, Pt, Pt, Pt];

/** Solve A x = b for a small dense system by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-9) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Row-major 3x3 mapping source points onto destination points (both clockwise from top-left). */
export function homography(src: Quad, dst: Quad): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return h ? [...h, 1] : null;
}

export function apply(h: number[], p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

export function rectQuad(x: number, y: number, w: number, h: number): Quad {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

/**
 * CSS matrix3d that maps an element of `w` x `h` CSS pixels (transform-origin
 * 0 0) onto `quad` in its containing block's pixel space. Null when degenerate.
 */
export function matrix3d(w: number, h: number, quad: Quad): string | null {
  const m = homography(rectQuad(0, 0, w, h), quad);
  if (!m || m.some((v) => !Number.isFinite(v))) return null;
  const [a, b, c, d, e, f, g, hh, i] = m;
  // Column-major 4x4; z row and column are identity so the element keeps no depth of its own.
  const cols = [a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, i];
  return `matrix3d(${cols.map((v) => v.toFixed(6)).join(",")})`;
}

export function center(q: Quad): Pt {
  return { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 };
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Mean side length, a usable "size on screen" for a roughly square marker. */
export function meanSide(q: Quad): number {
  return (dist(q[0], q[1]) + dist(q[1], q[2]) + dist(q[2], q[3]) + dist(q[3], q[0])) / 4;
}

/**
 * How readable a panel drawn on this quad would be: 1 is a flat rectangle,
 * values near 0 mean it is viewed almost edge-on. Compares opposite sides.
 */
export function readability(q: Quad): number {
  const top = dist(q[0], q[1]), bottom = dist(q[3], q[2]);
  const left = dist(q[0], q[3]), right = dist(q[1], q[2]);
  const horiz = Math.min(top, bottom) / Math.max(top, bottom, 1e-6);
  const vert = Math.min(left, right) / Math.max(left, right, 1e-6);
  return Math.min(horiz, vert);
}

export function inside(q: Quad, w: number, h: number, slack = 0): boolean {
  return q.every((p) => p.x >= -slack && p.y >= -slack && p.x <= w + slack && p.y <= h + slack);
}

/** Midpoint of the quad edge whose midpoint is closest to `from`. */
export function nearestEdgeMid(q: Quad, from: Pt): Pt {
  const mids: Pt[] = [0, 1, 2, 3].map((i) => {
    const a = q[i], b = q[(i + 1) % 4];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  });
  return mids.reduce((best, m) => (dist(m, from) < dist(best, from) ? m : best));
}

/** Where a ray from the circle's centre toward `dir` leaves the circle. */
export function exitCircle(c: Pt, r: number, toward: Pt): Pt {
  const dx = toward.x - c.x, dy = toward.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: c.x + (dx / len) * r, y: c.y + (dy / len) * r };
}
