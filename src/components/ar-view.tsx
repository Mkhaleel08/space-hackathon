"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ComponentCard as Card, Reading, Role } from "@/lib/types";

/**
 * Live view: the camera stays open and the part's card floats over the video,
 * pinned to the QR code with a leader line. Decoding runs on downscaled frames
 * with jsQR because it reports the code's corner points; html5-qrcode does not.
 */

type Pt = { x: number; y: number };
type Anchor = { id: string; corners: Pt[]; seenAt: number };
type CardState =
  | { kind: "loading" }
  | { kind: "ready"; card: Card }
  | { kind: "missing" }
  | { kind: "error" };
type ViewState = "idle" | "opening" | "running" | "error";

const DECODE_INTERVAL_MS = 90;
const DECODE_WIDTH = 420;
const LOST_AFTER_MS = 1200;
const GUTTER = 12;
const ROLE_KEY = "machine-memory:role";
const ROLE_EVENT = "machine-memory:role-updated";

const stripe: Record<Reading["status"], string> = {
  ok: "bg-emerald-500",
  watch: "bg-amber-400",
  alert: "bg-red-500",
};
const pill: Record<Reading["status"], string> = {
  ok: "bg-emerald-100 text-emerald-900",
  watch: "bg-amber-100 text-amber-900",
  alert: "bg-red-100 text-red-900",
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

export default function ArView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const lastDecodeRef = useRef(0);
  const smoothRef = useRef<Pt[] | null>(null);
  const cacheRef = useRef(new Map<string, Card>());
  const jsqrRef = useRef<typeof import("jsqr").default | null>(null);

  const [view, setView] = useState<ViewState>("idle");
  const [error, setError] = useState("");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [lost, setLost] = useState(false);
  // Role is shared with the full card page through the same storage key.
  const role = useSyncExternalStore(subscribeRole, readStoredRole, serverRole);
  const [cardState, setCardState] = useState<CardState>({ kind: "loading" });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cardH, setCardH] = useState(240);

  function selectRole(next: Role) {
    try {
      window.localStorage.setItem(ROLE_KEY, next);
    } catch {
      /* session only */
    }
    window.dispatchEvent(new Event(ROLE_EVENT));
  }

  // Measure the card so it can be placed above or below the code.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [anchor?.id, cardState.kind]);

  // Track the container size so overlay math survives rotation.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Stop everything on unmount.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

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
      const [{ default: jsQR }, stream] = await Promise.all([
        import("jsqr"),
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
      ]);
      jsqrRef.current = jsQR;
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
    const code = jsQR(img.data, cw, ch, { inversionAttempts: "dontInvert" });
    const id = code?.data.trim();
    if (!code || !id) return;

    const el = containerRef.current;
    if (!el) return;
    const { topLeftCorner: a, topRightCorner: b, bottomRightCorner: c, bottomLeftCorner: d } = code.location;
    const raw = [a, b, c, d].map((p) =>
      toScreen({ x: p.x / k, y: p.y / k }, vw, vh, el.clientWidth, el.clientHeight),
    );
    // Light smoothing so the pin does not jitter with hand shake.
    const prev = smoothRef.current;
    const corners = prev && prev.length === 4
      ? raw.map((p, i) => ({ x: prev[i].x + (p.x - prev[i].x) * 0.45, y: prev[i].y + (p.y - prev[i].y) * 0.45 }))
      : raw;
    smoothRef.current = corners;

    setAnchor((current) => {
      if (!current || current.id !== id) {
        smoothRef.current = raw;
        if ("vibrate" in navigator) navigator.vibrate?.(25);
        return { id, corners: raw, seenAt: performance.now() };
      }
      return { id, corners, seenAt: performance.now() };
    });
  }

  // Card placement: below the code if it fits, else above, else docked.
  const cardW = Math.min(size.w - GUTTER * 2, 380);
  let cardX = GUTTER;
  let cardY = size.h - cardH - GUTTER - 8;
  let docked = true;
  let center: Pt | null = null;
  if (anchor && size.w && !lost) {
    const xs = anchor.corners.map((p) => p.x);
    const ys = anchor.corners.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    cardX = Math.min(Math.max(center.x - cardW / 2, GUTTER), size.w - cardW - GUTTER);
    const topBar = 72;
    if (maxY + 20 + cardH <= size.h - GUTTER) {
      cardY = maxY + 20;
      docked = false;
    } else if (minY - 20 - cardH >= topBar) {
      cardY = minY - 20 - cardH;
      docked = false;
    }
  }
  const lineTarget: Pt | null = center && !docked
    ? { x: Math.min(Math.max(center.x, cardX + 24), cardX + cardW - 24), y: cardY > center.y ? cardY : cardY + cardH }
    : null;

  const running = view === "running";

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${running ? "opacity-100" : "opacity-0"}`}
      />

      {/* Reticle and leader line */}
      {running && anchor && size.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <g className={`transition-opacity duration-300 ${lost ? "opacity-0" : "opacity-100"}`}>
            <polygon
              points={anchor.corners.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(255,255,255,0.08)"
              stroke="white"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {anchor.corners.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="5" fill="white" />
            ))}
            {center && lineTarget && (
              <>
                <line x1={center.x} y1={center.y} x2={lineTarget.x} y2={lineTarget.y} stroke="white" strokeWidth="2" strokeDasharray="6 5" />
                <circle cx={center.x} cy={center.y} r="7" fill="white" />
                <circle cx={center.x} cy={center.y} r="14" fill="none" stroke="white" strokeWidth="2" className="animate-ping" style={{ transformOrigin: `${center.x}px ${center.y}px` }} />
              </>
            )}
          </g>
        </svg>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
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
              Keep the camera open. Point it at a part and its memory pins itself to the label.
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
          Point at a part’s QR code
        </p>
      )}

      {/* Pinned card */}
      {running && anchor && (
        <div
          ref={cardRef}
          role="region"
          aria-label="Part card"
          className="absolute left-0 top-0 transition-transform duration-150 ease-out will-change-transform"
          style={{ width: cardW, transform: `translate3d(${cardX}px, ${cardY}px, 0)` }}
        >
          <PinnedCard id={anchor.id} state={cardState} lost={lost} />
        </div>
      )}
    </div>
  );
}

function PinnedCard({ id, state, lost }: { id: string; state: CardState; lost: boolean }) {
  const href = `/components/${encodeURIComponent(id)}`;
  const shell = "overflow-hidden rounded-2xl bg-white/95 text-neutral-900 shadow-2xl shadow-black/40 backdrop-blur";

  if (state.kind === "loading") {
    return (
      <div className={`${shell} p-4`} aria-busy="true">
        <div className="h-1.5 w-full rounded-full bg-neutral-300" />
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-neutral-500">Found {id}</p>
        <p className="mt-1 text-lg font-semibold">Reading the machine’s memory…</p>
      </div>
    );
  }
  if (state.kind === "missing") {
    return (
      <div className={`${shell} p-4`}>
        <div className="h-1.5 w-full rounded-full bg-neutral-400" />
        <p className="mt-3 text-lg font-semibold">Unknown part</p>
        <p className="mt-1 text-sm text-neutral-600">This label isn’t in the machine’s history.</p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className={`${shell} p-4`}>
        <div className="h-1.5 w-full rounded-full bg-red-500" />
        <p className="mt-3 text-lg font-semibold">Couldn’t load this part</p>
        <Link href={href} className="mt-3 inline-flex min-h-11 items-center font-medium underline underline-offset-4">Open full card</Link>
      </div>
    );
  }

  const { card } = state;
  const status = worstStatus(card.readings);
  return (
    <div className={shell}>
      <div className={`h-1.5 w-full ${stripe[status]}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold leading-tight">{card.component.name}</h2>
            <p className="truncate text-sm text-neutral-600">{card.component.location}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${pill[status]}`}>
            {lost ? "last seen" : status}
          </span>
        </div>
        <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-neutral-800">{card.summary}</p>
        <div className="mt-3 rounded-xl bg-neutral-900 p-3 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Next step</p>
          <p className="mt-1 line-clamp-3 font-medium leading-snug">{card.next_step}</p>
        </div>
        {card.readings.length > 0 && (
          <ul className="mt-3 flex gap-1.5 overflow-x-auto" aria-label="Readings">
            {card.readings.map((r) => (
              <li key={r.label} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${pill[r.status]}`}>
                {r.label} {r.value}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={href}
          className="mt-3 flex min-h-12 items-center justify-center rounded-full bg-black px-4 font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          History &amp; add a note →
        </Link>
      </div>
    </div>
  );
}
