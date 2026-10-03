"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ComponentCard as Card, Reading, Role } from "@/lib/types";
import type { ArucoDetector } from "js-aruco2";
import { componentForTag, DICTIONARY } from "@/lib/markers";
import {
  apply,
  center,
  exitCircle,
  homography,
  inside,
  matrix3d,
  meanSide,
  nearestEdgeMid,
  readability,
  rectQuad,
  type Pt,
  type Quad,
} from "@/lib/homography";

/**
 * Live view. The camera stays open; when a QR label is in frame its four
 * corners define a plane, and three glass panels (status, next step, memory)
 * are drawn on that plane beside the label with leader lines flowing out from
 * a ring on the code. If the plane is viewed too obliquely or the panels would
 * leave the screen, the same panels fall back to a flat stack near the code.
 *
 * Recognition is AprilTag (36h11) via js-aruco2, which reads tags at steep
 * angles and small sizes. jsQR runs as a fallback so the older QR labels
 * keep working. Both report corner points, which the plane math needs.
 */

type Anchor = { id: string; quad: Quad; seenAt: number };
type CardState =
  | { kind: "loading" }
  | { kind: "ready"; card: Card }
  | { kind: "missing" }
  | { kind: "error" };
type ViewState = "idle" | "opening" | "running" | "error";
type PanelId = "head" | "next" | "memory";

const DECODE_INTERVAL_MS = 90;
const DECODE_WIDTH = 420;
const LOST_AFTER_MS = 1200;
const GUTTER = 12;
const PANEL_W = 300; // natural CSS px; the homography scales it to the scene
const PANEL_GAP_U = 0.14; // marker units between panels
const SIDE_GAP_U = 0.4; // marker units between the code and the panel column
const MIN_READABILITY = 0.55;
const MIN_SCALE = 0.72; // on-screen px per natural px; below this the type is too small
// How much true perspective the panels keep. 1 = lie exactly on the plane
// (text smears far from the tag), 0 = flat rotate-and-scale. A blend keeps
// the tilt cue while staying legible.
const PERSPECTIVE = 0.4;
const ROLE_KEY = "machine-memory:role";
const ROLE_EVENT = "machine-memory:role-updated";
const PANELS: PanelId[] = ["head", "next", "memory"];

const stripe: Record<Reading["status"], string> = {
  ok: "bg-emerald-400",
  watch: "bg-amber-400",
  alert: "bg-red-500",
};
const pill: Record<Reading["status"], string> = {
  ok: "bg-emerald-400/20 text-emerald-200 ring-emerald-300/40",
  watch: "bg-amber-400/20 text-amber-100 ring-amber-300/50",
  alert: "bg-red-500/25 text-red-100 ring-red-300/50",
};
const statusWord: Record<Reading["status"], string> = {
  ok: "Running normal",
  watch: "Watch closely",
  alert: "Needs attention",
};

function worstStatus(readings: Reading[]): Reading["status"] {
  if (readings.some((r) => r.status === "alert")) return "alert";
  if (readings.some((r) => r.status === "watch")) return "watch";
  return "ok";
}

function readStoredRole(): Role {
  try {
    const v = window.localStorage.getItem(ROLE_KEY);
    if (v === "operator" || v === "technician") return v;
  } catch {
    /* fall through */
  }
  return "operator";
}
function subscribeRole(callback: () => void) {
  window.addEventListener(ROLE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(ROLE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
const serverRole = (): Role => "operator";

function cameraError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission|denied/i.test(message)) {
    return "Camera permission was denied. Allow camera access in your browser’s site settings, then try again.";
  }
  if (/NotFound|DevicesNotFound/i.test(message)) {
    return "No camera was found. Open this page on a phone with a camera.";
  }
  if (/NotReadable|TrackStart/i.test(message)) {
    return "The camera is busy. Close other apps using it, then try again.";
  }
  return "The camera could not open. Check camera permission and close other camera apps, then try again.";
}

/** Map a point in video pixels to screen pixels for an object-fit: cover video. */
function toScreen(p: Pt, vw: number, vh: number, cw: number, ch: number): Pt {
  const s = Math.max(cw / vw, ch / vh);
  return { x: p.x * s + (cw - vw * s) / 2, y: p.y * s + (ch - vh * s) / 2 };
}

async function loadDetector(): Promise<ArucoDetector> {
  const mod = await import("js-aruco2");
  await import("js-aruco2/src/dictionaries/apriltag_36h11.js");
  return new mod.AR.Detector({ dictionaryName: DICTIONARY, maxHammingDistance: 3 });
}

/**
 * Detectors return corners in the marker's own frame, so a label taped on
 * sideways would put "below" off to one side. Re-order clockwise starting
 * from the screen top-left so panels always hang below the label on screen.
 */
function screenQuad(pts: Pt[]): Quad {
  let start = 0;
  for (let i = 1; i < 4; i++) if (pts[i].x + pts[i].y < pts[start].x + pts[start].y) start = i;
  const q = [0, 1, 2, 3].map((i) => pts[(start + i) % 4]) as Quad;
  // Ensure clockwise in screen space (y down): signed area must be positive.
  const area = q.reduce((acc, p, i) => {
    const n = q[(i + 1) % 4];
    return acc + (p.x * n.y - n.x * p.y);
  }, 0);
  return area < 0 ? ([q[0], q[3], q[2], q[1]] as Quad) : q;
}

/** Place marker-space points: a blend of the true plane homography and a
 * similarity transform (rotate + scale about the tag), see PERSPECTIVE. */
function makePlacer(H: number[], q: Quad) {
  const c = center(q);
  const side = meanSide(q);
  const ang = Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x);
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return (p: Pt): Pt => {
    const full = apply(H, p);
    const lx = (p.x - 0.5) * side, ly = (p.y - 0.5) * side;
    const flat = { x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos };
    return { x: flat.x + (full.x - flat.x) * PERSPECTIVE, y: flat.y + (full.y - flat.y) * PERSPECTIVE };
  };
}

export default function ArView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const lastDecodeRef = useRef(0);
  const smoothRef = useRef<Quad | null>(null);
  const cacheRef = useRef(new Map<string, Card>());
  const jsqrRef = useRef<typeof import("jsqr").default | null>(null);
  const detectorRef = useRef<ArucoDetector | null>(null);
  const tickCountRef = useRef(0);
  const startedRef = useRef(false);

  const [view, setView] = useState<ViewState>("idle");
  const [error, setError] = useState("");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [lost, setLost] = useState(false);
  const role = useSyncExternalStore(subscribeRole, readStoredRole, serverRole);
  const [cardState, setCardState] = useState<CardState>({ kind: "loading" });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Record<PanelId, number>>({ head: 96, next: 110, memory: 150 });
  // Expanded panels are remembered per pinned part, so moving to another
  // label starts collapsed without an effect to reset anything.
  const collapsed: Record<PanelId, boolean> = { head: false, next: false, memory: false };
  const [expandedFor, setExpandedFor] = useState<{ id: string } & Record<PanelId, boolean>>({ id: "", ...collapsed });
  const expanded: Record<PanelId, boolean> = expandedFor.id === (anchor?.id ?? "") ? expandedFor : collapsed;
  const togglePanel = (id: PanelId) =>
    setExpandedFor((prev) => {
      const base = prev.id === (anchor?.id ?? "") ? prev : { id: anchor?.id ?? "", ...collapsed };
      return { ...base, [id]: !base[id] };
    });

  function selectRole(next: Role) {
    try {
      window.localStorage.setItem(ROLE_KEY, next);
    } catch {
      /* session only */
    }
    window.dispatchEvent(new Event(ROLE_EVENT));
  }

  // Panel elements are kept in state (set from callback refs) so the
  // measuring effect can re-observe when a panel mounts or unmounts.
  // The callbacks must be stable: a new callback ref each render makes React
  // detach and reattach it, which would set state every render and loop.
  const [panelEls, setPanelEls] = useState<Record<PanelId, HTMLDivElement | null>>({ head: null, next: null, memory: null });
  const bindPanel = useMemo(() => {
    const make = (id: PanelId) => (el: HTMLDivElement | null) =>
      setPanelEls((prev) => (prev[id] === el ? prev : { ...prev, [id]: el }));
    return { head: make("head"), next: make("next"), memory: make("memory") } as Record<PanelId, (el: HTMLDivElement | null) => void>;
  }, []);

  // Container size, so overlay math survives rotation.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Panel natural heights, so the layout can stack them in marker units.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      setHeights((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of PANELS) {
          const h = panelEls[id]?.offsetHeight;
          if (h !== undefined && Math.abs(h - prev[id]) > 1) {
            next[id] = h;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    for (const id of PANELS) {
      const el = panelEls[id];
      if (el) ro.observe(el);
    }
    return () => ro.disconnect();
  }, [panelEls]);

  // Stop everything on unmount.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Open the camera as soon as the page loads. Browsers that insist on a tap
  // reject this, and the Start button below takes over.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch the card whenever the pinned part or the role changes.
  useEffect(() => {
    if (!anchor) return;
    const key = `${anchor.id}:${role}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setCardState({ kind: "ready", card: cached });
      return;
    }
    setCardState({ kind: "loading" });
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/components/${encodeURIComponent(anchor.id)}/card?role=${role}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (res.status === 404) return setCardState({ kind: "missing" });
        if (!res.ok) throw new Error("card failed");
        const card: Card = await res.json();
        cacheRef.current.set(key, card);
        setCardState({ kind: "ready", card });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setCardState({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [anchor?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark the anchor lost when the code leaves the frame.
  useEffect(() => {
    if (!anchor) return;
    const t = window.setInterval(() => {
      setLost(performance.now() - anchor.seenAt > LOST_AFTER_MS);
    }, 200);
    return () => window.clearInterval(t);
  }, [anchor]);

  async function start() {
    if (view === "opening" || view === "running") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access needs a secure connection. Open the HTTPS URL in Safari or Chrome on your phone.");
      setView("error");
      return;
    }
    setError("");
    setView("opening");
    try {
      const [{ default: jsQR }, detector, stream] = await Promise.all([
        import("jsqr"),
        loadDetector(),
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
      ]);
      jsqrRef.current = jsQR;
      detectorRef.current = detector;
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no video element");
      video.srcObject = stream;
      await video.play();
      setView("running");
      rafRef.current = requestAnimationFrame(tick);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError(cameraError(cause));
      setView("error");
    }
  }

  function tick(now: number) {
    rafRef.current = requestAnimationFrame(tick);
    if (now - lastDecodeRef.current < DECODE_INTERVAL_MS) return;
    lastDecodeRef.current = now;
    const video = videoRef.current;
    const jsQR = jsqrRef.current;
    if (!video || !jsQR || video.readyState < 2 || !video.videoWidth) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const k = Math.min(1, DECODE_WIDTH / vw);
    const cw = Math.round(vw * k);
    const ch = Math.round(vh * k);
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, cw, ch);
    const img = ctx.getImageData(0, 0, cw, ch);
    tickCountRef.current += 1;

    // AprilTag first. Fall back to QR every third frame so old labels still work.
    let id: string | null = null;
    let found: Pt[] | null = null;
    const markers = detectorRef.current?.detect(img) ?? [];
    for (const m of markers) {
      const cid = componentForTag(m.id);
      if (cid && m.corners.length === 4) {
        id = cid;
        found = m.corners;
        break;
      }
    }
    if (!found && tickCountRef.current % 3 === 0) {
      const code = jsQR(img.data, cw, ch, { inversionAttempts: "dontInvert" });
      const text = code?.data.trim();
      if (code && text) {
        const { topLeftCorner: a, topRightCorner: b, bottomRightCorner: c, bottomLeftCorner: d } = code.location;
        id = text;
        found = [a, b, c, d];
      }
    }
    if (!id || !found) return;

    const el = containerRef.current;
    if (!el) return;
    const raw = screenQuad(
      found.map((p) => toScreen({ x: p.x / k, y: p.y / k }, vw, vh, el.clientWidth, el.clientHeight)),
    );
    // Light smoothing so the panels do not jitter with hand shake.
    const prev = smoothRef.current;
    const quad = prev
      ? (raw.map((p, i) => ({ x: prev[i].x + (p.x - prev[i].x) * 0.45, y: prev[i].y + (p.y - prev[i].y) * 0.45 })) as Quad)
      : raw;
    smoothRef.current = quad;

    setAnchor((current) => {
      if (!current || current.id !== id) {
        smoothRef.current = raw;
        if ("vibrate" in navigator && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(25);
        return { id, quad: raw, seenAt: performance.now() };
      }
      return { id, quad, seenAt: performance.now() };
    });
  }

  // ---- Layout -----------------------------------------------------------
  // Panels live in marker units: the QR code is the unit square, y down.
  // Choose a column width so panels read at a sane size on screen whatever
  // the code's distance, then try to lay the column on the plane. Fall back
  // to a flat stack when the plane is too oblique or runs off screen.
  const tracked = Boolean(anchor && size.w && !lost);
  let mode: "world" | "flat" = "flat";
  let panelTransforms: Partial<Record<PanelId, string>> = {};
  let panelQuads: Partial<Record<PanelId, Quad>> = {};
  let ring: { c: Pt; r: number } | null = null;
  let flatX = GUTTER;
  let flatY = size.h - GUTTER;
  let flatBelow = true;
  const flatW = Math.min(size.w - GUTTER * 2, PANEL_W); // same width as world mode, so heights match
  const flatH = heights.head + heights.next + heights.memory + 16;

  if (tracked && anchor) {
    const q = anchor.quad;
    const side = Math.max(meanSide(q), 1);
    const c = center(q);
    ring = { c, r: Math.max(side * 0.8, 36) };

    const H = homography(rectQuad(0, 0, 1, 1), q);
    const TOP_BAR = 64;
    const ys = q.map((p) => p.y);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sumH = heights.head + heights.next + heights.memory; // natural px
    const gapPx = PANEL_GAP_U * side * 2;
    // On-screen px per natural panel px. Start from a comfortable size, then
    // shrink to the room available in the chosen direction, never below the
    // point where the type stops being readable.
    const idealScale = Math.min(Math.max(side * 2.6, 230), Math.min(380, size.w - GUTTER * 2)) / PANEL_W;
    const fitScale = (roomPx: number) => Math.min(idealScale, (roomPx - gapPx) / sumH);
    // Candidate placements, in order of preference: below, above, right, left.
    // Each gives the column's scale and its origin in marker units.
    const candidates: Array<{ scale: number; origin: (wU: number, totalU: number) => [number, number] }> = [
      { scale: fitScale(size.h - GUTTER - (maxY + SIDE_GAP_U * side)), origin: (wU) => [0.5 - wU / 2, 1 + SIDE_GAP_U] },
      { scale: fitScale(minY - SIDE_GAP_U * side - TOP_BAR), origin: (wU, totalU) => [0.5 - wU / 2, -SIDE_GAP_U - totalU] },
      { scale: idealScale, origin: (wU, totalU) => [1 + SIDE_GAP_U, 0.5 - totalU / 2] },
      { scale: idealScale, origin: (wU, totalU) => [-SIDE_GAP_U - wU, 0.5 - totalU / 2] },
    ];

    if (H) {
      const place = makePlacer(H, q);
      // Perspective makes lower panels taller than the flat estimate, so each
      // placement may step its scale down a few notches before giving up.
      const attempts = candidates.flatMap((cand) => [1, 0.92, 0.85, 0.78, 0.72].map((f) => ({ ...cand, scale: cand.scale * f })));
      for (const cand of attempts) {
        if (!(cand.scale >= MIN_SCALE)) continue;
        const wU = (cand.scale * PANEL_W) / side;
        const unitsPerPx = wU / PANEL_W;
        const hU: Record<PanelId, number> = {
          head: heights.head * unitsPerPx,
          next: heights.next * unitsPerPx,
          memory: heights.memory * unitsPerPx,
        };
        const totalU = hU.head + hU.next + hU.memory + PANEL_GAP_U * 2;
        const [x0, y0] = cand.origin(wU, totalU);
        const quads: Partial<Record<PanelId, Quad>> = {};
        const transforms: Partial<Record<PanelId, string>> = {};
        let ok = true;
        let y = y0;
        for (const id of PANELS) {
          const sq = rectQuad(x0, y, wU, hU[id]).map(place) as Quad;
          const clearOfBar = sq.every((p) => p.y >= TOP_BAR);
          if (!inside(sq, size.w, size.h, 6) || !clearOfBar || readability(sq) < MIN_READABILITY) {
            ok = false;
            break;
          }
          const t = matrix3d(PANEL_W, heights[id], sq);
          if (!t) {
            ok = false;
            break;
          }
          quads[id] = sq;
          transforms[id] = t;
          y += hU[id] + PANEL_GAP_U;
        }
        if (ok) {
          mode = "world";
          panelTransforms = transforms;
          panelQuads = quads;
          break;
        }
      }
    }

    if (mode === "flat") {
      flatX = Math.min(Math.max(c.x - flatW / 2, GUTTER), size.w - flatW - GUTTER);
      if (maxY + 20 + flatH <= size.h - GUTTER) {
        flatY = maxY + 20;
        flatBelow = true;
      } else if (minY - 20 - flatH >= 72) {
        flatY = minY - 20 - flatH;
        flatBelow = false;
      } else {
        flatY = size.h - flatH - GUTTER - 8;
        ring = null; // docked; no line to draw
      }
    }
  } else {
    flatY = size.h - flatH - GUTTER - 8;
  }

  const running = view === "running";
  const flatLine: { from: Pt; to: Pt } | null =
    mode === "flat" && ring && anchor
      ? {
          from: exitCircle(ring.c, ring.r, { x: flatX + flatW / 2, y: flatBelow ? flatY : flatY + flatH }),
          to: { x: Math.min(Math.max(ring.c.x, flatX + 24), flatX + flatW - 24), y: flatBelow ? flatY : flatY + flatH },
        }
      : null;

  const panelNodes = (
    <>
      <Panel id="head" setRef={bindPanel.head} state={cardState} partId={anchor?.id ?? ""} lost={lost} expanded={expanded.head} onToggle={() => togglePanel("head")} />
      <Panel id="next" setRef={bindPanel.next} state={cardState} partId={anchor?.id ?? ""} lost={lost} expanded={expanded.next} onToggle={() => togglePanel("next")} />
      <Panel id="memory" setRef={bindPanel.memory} state={cardState} partId={anchor?.id ?? ""} lost={lost} expanded={expanded.memory} onToggle={() => togglePanel("memory")} />
    </>
  );

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-black text-white">
      <style>{`@keyframes mm-flow { to { stroke-dashoffset: -28; } }`}</style>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${running ? "opacity-100" : "opacity-0"}`}
      />

      {/* Ring on the code and leader lines to the panels */}
      {running && anchor && size.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <g className={`transition-opacity duration-300 ${lost ? "opacity-0" : "opacity-100"}`}>
            <polygon
              points={anchor.quad.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {ring && (
              <>
                <circle cx={ring.c.x} cy={ring.c.y} r={ring.r} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="3" />
                <circle cx={ring.c.x} cy={ring.c.y} r={ring.r} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.25" />
              </>
            )}
            {ring && mode === "world" &&
              PANELS.map((id) => {
                const q = panelQuads[id];
                if (!q) return null;
                const to = nearestEdgeMid(q, ring!.c);
                const from = exitCircle(ring!.c, ring!.r, to);
                if (Math.hypot(to.x - from.x, to.y - from.y) < 12) return null;
                return <Leader key={id} from={from} to={to} />;
              })}
            {flatLine && <Leader from={flatLine.from} to={flatLine.to} />}
          </g>
        </svg>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="pointer-events-auto flex min-h-11 items-center rounded-full bg-black/50 px-4 font-medium backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          ← Machine Memory
        </Link>
        <div role="group" aria-label="View as" className="pointer-events-auto grid grid-cols-2 gap-0.5 rounded-full bg-black/50 p-0.5 backdrop-blur">
          {(["operator", "technician"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={role === v}
              onClick={() => selectRole(v)}
              className={`min-h-10 cursor-pointer rounded-full px-3 text-sm font-medium capitalize focus-visible:outline-2 focus-visible:outline-white ${role === v ? "bg-white text-black" : "text-white"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Idle / opening / error */}
      {!running && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
          <div>
            <h1 className="text-3xl font-semibold">Live view</h1>
            <p className="mt-3 max-w-xs text-balance text-neutral-300">
              Point the camera at a part. Its memory pins itself to the label, no buttons.
            </p>
          </div>
          {error && <p role="alert" className="max-w-sm text-red-300">{error}</p>}
          <button
            type="button"
            onClick={start}
            disabled={view === "opening"}
            aria-busy={view === "opening"}
            className="min-h-14 cursor-pointer rounded-full bg-white px-8 py-4 text-lg font-medium text-black hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
          >
            {view === "opening" ? "Opening camera…" : view === "error" ? "Try again" : "Start live view"}
          </button>
          <Link href="/scan" className="flex min-h-11 items-center text-sm text-neutral-300 underline underline-offset-4">
            Use the simple scanner instead
          </Link>
        </div>
      )}

      {/* Hint while nothing is pinned */}
      {running && !anchor && (
        <p role="status" className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] text-center text-lg font-medium text-white drop-shadow">
          Point at a part’s label
        </p>
      )}

      {/* Panels on the plane */}
      {running && anchor && mode === "world" && (
        <div className="absolute inset-0 z-10" aria-label="Part card" role="region">
          {PANELS.map((id) => (
            <div
              key={id}
              className="absolute left-0 top-0 origin-top-left transition-transform duration-100 ease-linear will-change-transform"
              style={{ width: PANEL_W, transform: panelTransforms[id] }}
            >
              <Panel id={id} setRef={bindPanel[id]} state={cardState} partId={anchor.id} lost={lost} expanded={expanded[id]} onToggle={() => togglePanel(id)} />
            </div>
          ))}
        </div>
      )}

      {/* Panels as a flat stack (oblique plane, edge of screen, or code lost) */}
      {running && anchor && mode === "flat" && (
        <div
          role="region"
          aria-label="Part card"
          className="absolute left-0 top-0 z-10 flex flex-col gap-2 transition-transform duration-150 ease-out will-change-transform"
          style={{ width: flatW, transform: `translate3d(${flatX}px, ${flatY}px, 0)` }}
        >
          {panelNodes}
        </div>
      )}
    </div>
  );
}

function Leader({ from, to }: { from: Pt; to: Pt }) {
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="rgba(251,191,36,0.9)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="3 11"
        style={{ animation: "mm-flow 0.9s linear infinite" }}
      />
      <circle cx={from.x} cy={from.y} r="2.5" fill="white" />
      <circle cx={to.x} cy={to.y} r="3" fill="rgb(251,191,36)" />
    </g>
  );
}

/** Frosted dark glass: body tint, top sheen, hairline edge. No backdrop-filter, it fights matrix3d on iOS. */
const glass = "rounded-2xl border border-white/15 text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]";
const glassStyle: React.CSSProperties = {
  background:
    "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 38%, rgba(0,0,0,0) 60%), rgba(12,16,24,0.82)",
};

const eventDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function Panel({
  id,
  setRef,
  state,
  partId,
  lost,
  expanded,
  onToggle,
}: {
  id: PanelId;
  setRef: (el: HTMLDivElement | null) => void;
  state: CardState;
  partId: string;
  lost: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Every panel is a tap target: tap to expand in place, tap again to collapse.
  const tappable = {
    role: "button" as const,
    tabIndex: 0,
    "aria-expanded": expanded,
    onClick: onToggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
  };
  const more = (
    <span aria-hidden="true" className="ml-auto shrink-0 font-mono text-[10px] text-white/50">
      {expanded ? "less ▴" : "more ▾"}
    </span>
  );
  const href = `/components/${encodeURIComponent(partId)}`;
  const label = (text: string, extra = "") => (
    <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 ${extra}`}>{text}</p>
  );

  if (state.kind !== "ready") {
    if (id !== "head") return <div ref={setRef} className="h-0" aria-hidden="true" />;
    return (
      <div ref={setRef} style={glassStyle} className={`${glass} p-4`} aria-busy={state.kind === "loading"}>
        {label(state.kind === "loading" ? `Found ${partId}` : partId)}
        <p className="mt-1 text-lg font-semibold leading-tight">
          {state.kind === "loading" && "Reading the machine’s memory…"}
          {state.kind === "missing" && "Unknown part"}
          {state.kind === "error" && "Couldn’t load this part"}
        </p>
        {state.kind === "missing" && <p className="mt-1 text-sm text-white/70">This label isn’t in the machine’s history.</p>}
        {state.kind === "error" && (
          <Link href={href} className="mt-3 inline-flex min-h-11 items-center font-medium underline underline-offset-4">Open full card</Link>
        )}
      </div>
    );
  }

  const { card } = state;
  const status = worstStatus(card.readings);

  if (id === "head") {
    return (
      <div ref={setRef} style={glassStyle} className={`${glass} cursor-pointer overflow-hidden select-none`} {...tappable}>
        <div className={`h-1 w-full ${stripe[status]}`} />
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {label(card.asset.name)}
              <h2 className="mt-0.5 line-clamp-2 text-[19px] font-semibold leading-tight">{card.component.name}</h2>
              <p className="truncate text-xs text-white/70">{card.component.location}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${pill[status]}`}>
              {lost ? "Last seen" : statusWord[status]}
            </span>
          </div>
          {card.readings.length > 0 && !expanded && (
            <ul className="mt-2.5 flex items-center gap-1.5 overflow-hidden" aria-label="Readings">
              {card.readings.map((r) => (
                <li key={r.label} className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] ring-1 ${pill[r.status]}`}>
                  {r.value}
                </li>
              ))}
              {more}
            </ul>
          )}
          {expanded && (
            <div className="mt-3">
              <dl className="grid gap-1.5">
                {card.readings.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <dt className="text-white/70">{r.label}</dt>
                    <dd className="flex items-baseline gap-2">
                      <span className="font-mono font-semibold">{r.value}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${pill[r.status]}`}>{r.status}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2.5 flex items-center text-[11px] text-white/50">
                {card.asset.hours.toLocaleString("en-US")} engine hours · readings simulated for this demo {more}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (id === "next") {
    return (
      <div ref={setRef} style={glassStyle} className={`${glass} cursor-pointer p-3.5 select-none`} {...tappable}>
        <div className="flex items-center">{label("Next step", "text-amber-200/90")}{more}</div>
        <p className={`mt-1 text-[16px] font-semibold leading-snug ${expanded ? "" : "line-clamp-3"}`}>{card.next_step}</p>
        {expanded && (
          <p className="mt-2 text-[12px] text-white/60">Written for the {card.role} from this part’s history. Switch roles above to change the wording.</p>
        )}
      </div>
    );
  }

  return (
    <div ref={setRef} style={glassStyle} className={`${glass} cursor-pointer p-3.5 select-none`} {...tappable}>
      <div className="flex items-center">{label("What this part remembers")}{more}</div>
      <p className={`mt-1 text-[14px] leading-snug text-white/85 ${expanded ? "" : "line-clamp-2"}`}>{card.summary}</p>
      {expanded && card.recent_events.length > 0 && (
        <ol className="mt-3 border-l border-white/20" aria-label="Recent history">
          {card.recent_events.slice(0, 4).map((e) => (
            <li key={e.id} className="relative pb-2.5 pl-3 text-[12px] leading-snug before:absolute before:-left-[3px] before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-white/70 last:pb-0">
              <span className="font-mono text-[10px] uppercase text-white/50">
                {e.type} · {Number.isNaN(Date.parse(e.created_at)) ? "" : eventDate.format(new Date(e.created_at))}
              </span>
              <p className="text-white/90">{e.summary}</p>
            </li>
          ))}
        </ol>
      )}
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className="mt-3 flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {expanded ? "Add a note →" : "History & add a note →"}
      </Link>
    </div>
  );
}
