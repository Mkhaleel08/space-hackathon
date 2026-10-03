"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ComponentCard as Card, NewNoteRequest, NewNoteResponse, Reading, Role, TagAssignment } from "@/lib/types";
import type { ArucoDetector } from "js-aruco2";
import { DICTIONARY, TAG_TO_COMPONENT } from "@/lib/markers";
import { ArrowLeft } from "./icons";
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
 * Live view. The camera stays open and every label in frame gets a node: a
 * dot on the label joined by a line to a compact chip (name + status). Tap a
 * chip and it opens into three glass panels (status, next step, memory)
 * beside its label; nothing opens until it is tapped. From the memory panel
 * you can speak a note: the browser transcribes it, the backend's model turns
 * it into a structured event, and the card re-reads its memory. Nodes glide toward
 * each new detection every animation frame so they move smoothly, and stay
 * upright on screen while tracking position and distance (see LOCK_UPRIGHT). If the plane is viewed too obliquely or the panels would
 * leave the screen, the same panels fall back to a flat stack near the code.
 *
 * Recognition is AprilTag (36h11) via js-aruco2, which reads tags at steep
 * angles and small sizes. jsQR runs as a fallback so the older QR labels
 * keep working. Both report corner points, which the plane math needs.
 */

/** One tracked label. `target` is the latest detection, `display` glides toward it every frame. */
type Track = { target: Quad; display: Quad; seenAt: number; firstSeen: number; lost: boolean };
type Anchor = { id: string; quad: Quad; lost: boolean; firstSeen: number };
type CardState =
  | { kind: "loading" }
  | { kind: "ready"; card: Card }
  | { kind: "missing" }
  | { kind: "error" };
type ViewState = "idle" | "opening" | "running" | "error";
type PanelId = "head" | "next" | "memory";

/** A spoken note in progress on the open part. `text` is final, `interim` is still being heard. */
type VoiceState = { id: string; phase: "listening" | "review" | "saving" | "saved" | "error"; text: string; interim: string; message: string };
type VoiceAction = "start" | "stop" | "save" | "cancel";

// Browser speech recognition is not in TypeScript's DOM types.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
function speechConstructor() {
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
const noSubscribe = () => () => {};
const speechSupported = () => Boolean(speechConstructor());
const speechOnServer = () => false;

const DECODE_INTERVAL_MS = 90;
const DECODE_WIDTH = 420;
const LOST_AFTER_MS = 700; // the label has been out of frame this long: hide its marks, fade its node
const REMOVE_AFTER_MS = 1600; // then drop it
const CAMERA: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
};
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEPS = [1, 1.5, 2, 3, 4]; // what the + and − buttons step through; pinch is continuous
const SMOOTH_TAU_MS = 70; // per-frame easing time constant; ~3x this to settle
const CHIP_W = 200; // compact node size, CSS px
const CHIP_W_NARROW = 136; // when labels crowd each other: dot + name only
const CHIP_H = 44;
const CHIP_GAP = 14; // between a label and its node
const DOT_R = 5;
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
// Panels stay upright on screen ("locked to the horizon"): they follow the
// tag's position and distance but never its roll or perspective, so the text
// reads level however the label is taped on or the phone is held.
const LOCK_UPRIGHT = true;
const ROLE_KEY = "machine-memory:role";
const ROLE_EVENT = "machine-memory:role-updated";
const PANELS: PanelId[] = ["head", "next", "memory"];
const VOICE_DONE_MS = 2800; // how long "memory updated" stays before the panel goes back to normal

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

/** The camera's own zoom range, when the browser exposes it (Android Chrome, iOS 17+). */
function hardwareZoom(track: MediaStreamTrack): { min: number; max: number; current: number } | null {
  const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min?: number; max?: number } }) | undefined;
  const z = caps?.zoom;
  if (!z || typeof z.min !== "number" || typeof z.max !== "number" || !(z.max > z.min)) return null;
  const current = (track.getSettings() as MediaTrackSettings & { zoom?: number }).zoom;
  return { min: z.min, max: z.max, current: current ?? z.min };
}

function stepZoom(level: number, dir: 1 | -1): number {
  const steps = dir === 1 ? ZOOM_STEPS.filter((z) => z > level + 0.01) : ZOOM_STEPS.filter((z) => z < level - 0.01);
  return steps.length ? (dir === 1 ? steps[0] : steps[steps.length - 1]) : level;
}

const formatZoom = (z: number) => `${Number.isInteger(z) ? z : z.toFixed(1)}×`;

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
  const ang = LOCK_UPRIGHT ? 0 : Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x);
  const persp = LOCK_UPRIGHT ? 0 : PERSPECTIVE;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return (p: Pt): Pt => {
    const full = apply(H, p);
    const lx = (p.x - 0.5) * side, ly = (p.y - 0.5) * side;
    const flat = { x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos };
    return { x: flat.x + (full.x - flat.x) * persp, y: flat.y + (full.y - flat.y) * persp };
  };
}

export default function ArView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Tag id -> component id. Starts from the static map and is replaced by the
  // live table once /api/tags answers, so parts added on the dashboard work
  // without a redeploy.
  const tagMapRef = useRef<Record<number, string>>(TAG_TO_COMPONENT);
  // iOS Safari will not start speech recognition while the page holds the
  // camera. Once we learn that on this device, the camera is released while
  // listening and re-opened afterwards.
  const micNeedsCameraRef = useRef(false);
  const cameraPausedRef = useRef(false);
  const rafRef = useRef(0);
  const lastDecodeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const tracksRef = useRef(new Map<string, Track>());
  const dirtyRef = useRef(false);
  const cacheRef = useRef(new Map<string, Card>());
  const inflightRef = useRef(new Set<string>());
  const jsqrRef = useRef<typeof import("jsqr").default | null>(null);
  const detectorRef = useRef<ArucoDetector | null>(null);
  const tickCountRef = useRef(0);
  const startedRef = useRef(false);
  const openRef = useRef<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const voiceRef = useRef<VoiceState | null>(null);
  // Zoom. The camera does what it can; the rest is a centre crop of the frame.
  const zoomLevelRef = useRef(1); // what the user asked for
  const digitalZoomRef = useRef(1); // the share the camera could not do, applied by cropping
  const hwBaseRef = useRef<number | null>(null); // the camera's zoom setting when its stream opened
  const zoomBusyRef = useRef(false);
  const zoomPendingRef = useRef<number | null>(null);

  const [view, setView] = useState<ViewState>("idle");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const role = useSyncExternalStore(subscribeRole, readStoredRole, serverRole);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [voiceState, setVoiceState] = useState<VoiceState | null>(null);
  const speechOk = useSyncExternalStore(noSubscribe, speechSupported, speechOnServer);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Record<PanelId, number>>({ head: 96, next: 110, memory: 150 });
  // Expanded panels are remembered per open part, so switching to another
  // label starts collapsed without an effect to reset anything.
  const collapsed: Record<PanelId, boolean> = { head: false, next: false, memory: false };
  const [expandedFor, setExpandedFor] = useState<{ id: string } & Record<PanelId, boolean>>({ id: "", ...collapsed });
  const expanded: Record<PanelId, boolean> = expandedFor.id === (openId ?? "") ? expandedFor : collapsed;
  const togglePanel = useCallback(
    (id: PanelId) =>
      setExpandedFor((prev) => {
        const base = prev.id === (openId ?? "") ? prev : { id: openId ?? "", head: false, next: false, memory: false };
        return { ...base, [id]: !base[id] };
      }),
    [openId],
  );

  const cardFor = (id: string): CardState => cards[`${id}:${role}`] ?? { kind: "loading" };

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
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  // Open the camera as soon as the page loads. Browsers that insist on a tap
  // reject this, and the Start button below takes over.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch a card for every label in view (and again when the role changes),
  // so the compact nodes can show status before anyone taps.
  const visibleIds = anchors.map((a) => a.id).join("\u0000");
  useEffect(() => {
    const ids = visibleIds ? visibleIds.split("\u0000") : [];
    for (const id of ids) {
      const key = `${id}:${role}`;
      if (cards[key] && cards[key].kind !== "error") continue;
      const cached = cacheRef.current.get(key);
      if (cached) {
        setCards((prev) => ({ ...prev, [key]: { kind: "ready", card: cached } }));
        continue;
      }
      if (inflightRef.current.has(key)) continue;
      inflightRef.current.add(key);
      setCards((prev) => (prev[key]?.kind === "loading" ? prev : { ...prev, [key]: { kind: "loading" } }));
      (async () => {
        try {
          const res = await fetch(`/api/components/${encodeURIComponent(id)}/card?role=${role}`, { cache: "no-store" });
          if (res.status === 404) return setCards((prev) => ({ ...prev, [key]: { kind: "missing" } }));
          if (!res.ok) throw new Error("card failed");
          const card: Card = await res.json();
          cacheRef.current.set(key, card);
          setCards((prev) => ({ ...prev, [key]: { kind: "ready", card } }));
        } catch {
          setCards((prev) => ({ ...prev, [key]: { kind: "error" } }));
        } finally {
          inflightRef.current.delete(key);
        }
      })();
    }
  }, [visibleIds, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Which node is open: only a tap opens one, nothing opens by itself. A node
  // whose label has gone closes. Decided in the frame loop, mirrored in openRef.
  // Voice state is mirrored in voiceRef so the frame loop and recognition
  // callbacks can read it without going through React.
  const setVoice = useCallback((next: VoiceState | null | ((prev: VoiceState | null) => VoiceState | null)) => {
    const value = typeof next === "function" ? next(voiceRef.current) : next;
    voiceRef.current = value;
    setVoiceState(value);
  }, []);
  /**
   * Zoom the camera itself where the browser allows it and crop the frame for
   * whatever is left. The crop also hands the detector more pixels per label,
   * so small or far tags read better either way.
   */
  const applyZoom = useCallback(async (requested: number) => {
    const level = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, requested));
    zoomLevelRef.current = level;
    setZoom(level);
    if (zoomBusyRef.current) {
      zoomPendingRef.current = level;
      return;
    }
    zoomBusyRef.current = true;
    let hardware = 1;
    const track = streamRef.current?.getVideoTracks()[0];
    const range = track ? hardwareZoom(track) : null;
    if (track && range) {
      const base = (hwBaseRef.current ??= range.current);
      const target = Math.min(range.max, Math.max(range.min, base * level));
      try {
        await track.applyConstraints({ advanced: [{ zoom: target }] } as unknown as MediaTrackConstraints);
        hardware = target / base;
      } catch {
        /* this camera will not zoom; crop instead */
      }
    }
    const digital = level / hardware;
    digitalZoomRef.current = digital;
    setDigitalZoom(digital);
    zoomBusyRef.current = false;
    const pending = zoomPendingRef.current;
    zoomPendingRef.current = null;
    if (pending !== null && Math.abs(pending - level) > 0.001) void applyZoomRef.current(pending);
  }, []);
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;
  // Pinch to zoom. Native listeners because React registers touch handlers as
  // passive, and we need preventDefault so Safari does not zoom the page.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startDist = 0;
    let startLevel = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      startDist = dist(e.touches);
      startLevel = zoomLevelRef.current;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      void applyZoom(startLevel * (dist(e.touches) / startDist));
    };
    const onEnd = () => {
      startDist = 0;
    };
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("gesturestart", block);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("gesturestart", block);
    };
  }, [applyZoom]);

  const pauseCamera = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cameraPausedRef.current = true;
  }, []);
  const resumeCamera = useCallback(() => {
    if (!cameraPausedRef.current) return;
    cameraPausedRef.current = false;
    navigator.mediaDevices
      .getUserMedia(CAMERA)
      .then(async (stream) => {
        const video = videoRef.current;
        if (!video || cameraPausedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        hwBaseRef.current = null;
        void applyZoom(zoomLevelRef.current);
      })
      .catch((cause) => {
        setError(cameraError(cause));
        setView("error");
      });
  }, [applyZoom]);
  const dropRecognition = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.abort();
  }, []);
  const openNode = useCallback(
    (id: string | null) => {
      if (voiceRef.current && voiceRef.current.id !== id) {
        dropRecognition();
        resumeCamera();
        setVoice(null);
      }
      openRef.current = id;
      setOpenId(id);
    },
    [dropRecognition, resumeCamera, setVoice],
  );
  const closeNode = useCallback(() => openNode(null), [openNode]);

  // Speak a note on the open part. The browser transcribes, the backend's
  // model files it as a structured event, then the card re-reads its memory
  // so the summary and next step reflect what was just said.
  const voiceAction = useCallback(
    (id: string, action: VoiceAction) => {
      if (action === "cancel") {
        dropRecognition();
        resumeCamera();
        setVoice(null);
        return;
      }
      if (action === "stop") {
        recRef.current?.stop();
        return;
      }
      if (action === "start") {
        const Speech = speechConstructor();
        if (!Speech) return;
        dropRecognition();
        if (micNeedsCameraRef.current) pauseCamera();
        const rec = new Speech();
        rec.lang = "en-US";
        rec.continuous = false;
        rec.interimResults = true;
        let finalText = "";
        let lastInterim = "";
        const heardNothing = "Didn’t catch anything. Tap the mic and try again.";
        rec.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText = [finalText, r[0].transcript].join(" ").trim();
            else interim += r[0].transcript;
          }
          lastInterim = interim.trim();
          setVoice((v) => (v && v.id === id && v.phase === "listening" ? { ...v, text: finalText, interim: lastInterim } : v));
        };
        rec.onerror = (e) => {
          if (recRef.current !== rec) return;
          recRef.current = null;
          const denied = e.error === "not-allowed" || e.error === "service-not-allowed";
          const stillListening = () => voiceRef.current?.id === id && voiceRef.current.phase === "listening";
          // First failure with the camera open: assume the mic is held by the
          // camera (iOS), release it, and try once more without asking.
          if (!denied && e.error !== "no-speech" && !micNeedsCameraRef.current && streamRef.current) {
            micNeedsCameraRef.current = true;
            pauseCamera();
            window.setTimeout(() => {
              if (stillListening()) voiceAction(id, "start");
            }, 350);
            return;
          }
          resumeCamera();
          const message = denied
            ? "Microphone access was denied. Open the full card to type a note."
            : e.error === "no-speech"
              ? heardNothing
              : e.error === "audio-capture"
                ? "The phone wouldn’t share the microphone. Open the full card to type a note."
                : e.error === "network"
                  ? "Dictation is turned off on this phone. Turn on Enable Dictation in Settings › General › Keyboard, or open the full card to type."
                  : `Dictation stopped early (${e.error}). Tap the mic to try again.`;
          setVoice((v) => (v && v.id === id ? { ...v, phase: "error", interim: "", message } : v));
        };
        rec.onend = () => {
          if (recRef.current !== rec) return; // dropped, or already reported an error
          recRef.current = null;
          resumeCamera();
          const text = (finalText || lastInterim).trim();
          setVoice((v) => {
            if (!v || v.id !== id || v.phase !== "listening") return v;
            return text ? { ...v, phase: "review", text, interim: "" } : { ...v, phase: "error", text: "", interim: "", message: heardNothing };
          });
        };
        recRef.current = rec;
        setVoice({ id, phase: "listening", text: "", interim: "", message: "" });
        try {
          rec.start();
        } catch {
          recRef.current = null;
          resumeCamera();
          setVoice({ id, phase: "error", text: "", interim: "", message: "Dictation isn’t available right now. Open the full card to type a note." });
        }
        return;
      }
      // save
      const v = voiceRef.current;
      if (!v || v.id !== id || v.phase !== "review" || !v.text.trim()) return;
      const text = v.text.trim();
      const author = role;
      const key = `${id}:${author}`;
      const otherKey = `${id}:${author === "operator" ? "technician" : "operator"}`;
      setVoice({ ...v, phase: "saving", message: "" });
      (async () => {
        try {
          const body: NewNoteRequest = { text, author_role: author };
          const res = await fetch(`/api/components/${encodeURIComponent(id)}/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`notes ${res.status}`);
          const { event } = (await res.json()) as NewNoteResponse;
          if (!event?.id) throw new Error("no event");
          // Show the new memory at once; the rewritten summary follows.
          const patch = (c: Card): Card => ({ ...c, recent_events: [event, ...c.recent_events.filter((e) => e.id !== event.id)].slice(0, 5) });
          const cached = cacheRef.current.get(key);
          if (cached) cacheRef.current.set(key, patch(cached));
          cacheRef.current.delete(otherKey);
          setCards((prev) => {
            const next = { ...prev };
            delete next[otherKey]; // the other role re-reads on its next switch
            const s = prev[key];
            if (s?.kind === "ready") next[key] = { kind: "ready", card: patch(s.card) };
            return next;
          });
          setExpandedFor((prev) => ({ ...(prev.id === id ? prev : { id, head: false, next: false, memory: false }), memory: true }));
          setVoice((cur) => (cur && cur.id === id && cur.phase === "saving" ? { ...cur, phase: "saved", message: `Filed as ${event.type}. Re-reading the memory…` } : cur));
          const fresh = await fetch(`/api/components/${encodeURIComponent(id)}/card?role=${author}`, { cache: "no-store" });
          if (fresh.ok) {
            const card: Card = await fresh.json();
            cacheRef.current.set(key, card);
            setCards((prev) => ({ ...prev, [key]: { kind: "ready", card } }));
          }
          setVoice((cur) => (cur && cur.id === id && cur.phase === "saved" ? { ...cur, message: "Memory updated." } : cur));
          window.setTimeout(() => setVoice((cur) => (cur && cur.id === id && cur.phase === "saved" ? null : cur)), VOICE_DONE_MS);
        } catch {
          setVoice((cur) => (cur && cur.id === id && cur.phase === "saving" ? { ...cur, phase: "review", message: "Couldn’t save. Check the connection and try again." } : cur));
        }
      })();
    },
    [dropRecognition, pauseCamera, resumeCamera, role, setVoice],
  );

  async function start() {
    if (view === "opening" || view === "running") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access needs a secure connection. Open the HTTPS URL in Safari or Chrome on your phone.");
      setView("error");
      return;
    }
    setError("");
    setView("opening");
    fetch("/api/tags", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<TagAssignment[]>) : Promise.reject(new Error(String(r.status)))))
      .then((tags) => {
        const live: Record<number, string> = { ...TAG_TO_COMPONENT };
        for (const t of tags) live[t.tag_id] = t.component_id;
        tagMapRef.current = live;
      })
      .catch(() => { /* keep the static map */ });
    try {
      const [{ default: jsQR }, detector, stream] = await Promise.all([
        import("jsqr"),
        loadDetector(),
        navigator.mediaDevices.getUserMedia(CAMERA),
      ]);
      jsqrRef.current = jsQR;
      detectorRef.current = detector;
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no video element");
      video.srcObject = stream;
      await video.play();
      hwBaseRef.current = null;
      void applyZoom(zoomLevelRef.current);
      setView("running");
      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError(cameraError(cause));
      setView("error");
    }
  }

  /** Read every label in the frame and update its track's target corners. */
  function decode(now: number) {
    const video = videoRef.current;
    const jsQR = jsqrRef.current;
    if (!video || !jsQR || video.readyState < 2 || !video.videoWidth) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Scale by the short side, not the width: a landscape frame (1280x720) would
    // otherwise shrink almost twice as hard as a portrait one (720x1280) and
    // tags that read fine upright fall below the detector's minimum size.
    const k = Math.min(1, DECODE_WIDTH / Math.min(vw, vh));
    const cw = Math.round(vw * k);
    const ch = Math.round(vh * k);
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    // Digital zoom: read only the centre of the frame. The video element is
    // scaled by the same factor about the same centre, so toScreen() below
    // still holds without knowing about zoom.
    const z = digitalZoomRef.current;
    const sw = vw / z;
    const sh = vh / z;
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cw, ch);
    const img = ctx.getImageData(0, 0, cw, ch);
    tickCountRef.current += 1;

    // AprilTags first, all of them. Fall back to QR every third frame so old
    // labels still work (jsQR reads one code per frame).
    const seen = new Map<string, Pt[]>();
    const markers = detectorRef.current?.detect(img) ?? [];
    for (const m of markers) {
      const cid = tagMapRef.current[m.id] ?? null;
      if (cid && m.corners.length === 4 && !seen.has(cid)) seen.set(cid, m.corners);
    }
    if (seen.size === 0 && tickCountRef.current % 3 === 0) {
      const code = jsQR(img.data, cw, ch, { inversionAttempts: "dontInvert" });
      const text = code?.data.trim();
      if (code && text) {
        const { topLeftCorner: a, topRightCorner: b, bottomRightCorner: c, bottomLeftCorner: d } = code.location;
        seen.set(text, [a, b, c, d]);
      }
    }
    if (seen.size === 0) return;

    const el = containerRef.current;
    if (!el) return;
    for (const [id, pts] of seen) {
      const raw = screenQuad(pts.map((p) => toScreen({ x: p.x / k, y: p.y / k }, vw, vh, el.clientWidth, el.clientHeight)));
      const track = tracksRef.current.get(id);
      if (track) {
        track.target = raw;
        track.seenAt = now;
      } else {
        tracksRef.current.set(id, { target: raw, display: raw, seenAt: now, firstSeen: now, lost: false });
        dirtyRef.current = true;
        if ("vibrate" in navigator && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(25);
      }
    }
  }

  /** Every frame: decode on a budget, then glide each node toward its target. */
  function tick(now: number) {
    rafRef.current = requestAnimationFrame(tick);
    const dt = lastFrameRef.current ? Math.min(now - lastFrameRef.current, 100) : 16;
    lastFrameRef.current = now;
    if (now - lastDecodeRef.current >= DECODE_INTERVAL_MS) {
      lastDecodeRef.current = now;
      decode(now);
    }

    const a = 1 - Math.exp(-dt / SMOOTH_TAU_MS);
    let changed = dirtyRef.current;
    dirtyRef.current = false;
    const next: Anchor[] = [];
    for (const [id, t] of tracksRef.current) {
      const age = now - t.seenAt;
      // A part with a spoken note in progress stays (docked, as lost) until the note is done.
      if (age > REMOVE_AFTER_MS && voiceRef.current?.id !== id) {
        tracksRef.current.delete(id);
        changed = true;
        continue;
      }
      const d = t.display.map((p, i) => ({ x: p.x + (t.target[i].x - p.x) * a, y: p.y + (t.target[i].y - p.y) * a })) as Quad;
      if (!changed && d.some((p, i) => Math.abs(p.x - t.display[i].x) > 0.02 || Math.abs(p.y - t.display[i].y) > 0.02)) changed = true;
      t.display = d;
      const lost = age > LOST_AFTER_MS;
      if (lost !== t.lost) {
        t.lost = lost;
        changed = true;
      }
      next.push({ id, quad: d, lost, firstSeen: t.firstSeen });
    }
    if (!changed) return;
    next.sort((x, y) => x.firstSeen - y.firstSeen);
    const current = openRef.current;
    if (current && !next.some((x) => x.id === current)) openNode(null);
    setAnchors(next);
  }

  // ---- Layout -----------------------------------------------------------
  // The open label gets the three panels; every other label gets a compact
  // node above it. Panels live in marker units: the label is the unit
  // square, y down. Choose a column width so panels read at a sane size on
  // screen whatever the label's distance, then try to lay the column beside
  // it. Fall back to a flat stack when the column would not fit.
  const open = openId ? anchors.find((x) => x.id === openId) ?? null : null;
  const tracked = Boolean(open && size.w && !open.lost);
  let mode: "world" | "flat" = "flat";
  let panelTransforms: Partial<Record<PanelId, string>> = {};
  let panelQuads: Partial<Record<PanelId, Quad>> = {};
  let dot: Pt | null = null;
  let flatX = GUTTER;
  let flatY = size.h - GUTTER;
  let flatBelow = true;
  const flatW = Math.min(size.w - GUTTER * 2, PANEL_W); // same width as world mode, so heights match
  const flatH = heights.head + heights.next + heights.memory + 16;
  const TOP_BAR = 64;

  if (tracked && open) {
    const q = open.quad;
    const side = Math.max(meanSide(q), 1);
    const c = center(q);
    dot = c;

    const H = homography(rectQuad(0, 0, 1, 1), q);
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
        dot = null; // docked; no line to draw
      }
    }
  } else {
    flatY = size.h - flatH - GUTTER - 8;
  }

  // Compact nodes, one per label, while nothing is open: a chip above the
  // label (below it when there is no room), nudged apart when two would
  // overlap. While a card is open the other labels step back entirely so the
  // panels have the screen; the X on the card brings the chips back.
  // A chip stays over its own label: centred above it, below it only when the
  // top bar is in the way. When another label is close enough that full chips
  // would collide, both go narrow (dot + name). A chip that still collides
  // slides sideways, never up or down into someone else's label.
  type Chip = { id: string; left: number; top: number; w: number; above: boolean; c: Pt; lost: boolean };
  const chips: Chip[] = [];
  if (size.w && !open) {
    const live = anchors.filter((a) => !a.lost);
    const centers = new Map(anchors.map((a) => [a.id, center(a.quad)] as const));
    for (const a of anchors) {
      const c = centers.get(a.id)!;
      const crowded = live.some((o) => {
        if (o.id === a.id) return false;
        const oc = centers.get(o.id)!;
        return Math.abs(oc.x - c.x) < CHIP_W + 8 && Math.abs(oc.y - c.y) < CHIP_H * 2 + CHIP_GAP;
      });
      const w = crowded ? CHIP_W_NARROW : CHIP_W;
      const ys = a.quad.map((p) => p.y);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const clampX = (x: number) => Math.min(Math.max(x, GUTTER), size.w - w - GUTTER);
      let left = clampX(c.x - w / 2);
      let above = true;
      let top = minY - CHIP_GAP - CHIP_H;
      if (top < TOP_BAR + 4) {
        above = false;
        top = Math.min(maxY + CHIP_GAP, size.h - GUTTER - CHIP_H);
      }
      for (const other of chips) {
        const sameRow = Math.abs(other.top - top) < CHIP_H + 6;
        const overlap = Math.min(left + w, other.left + other.w) - Math.max(left, other.left) + 6;
        if (!sameRow || overlap <= 0) continue;
        // Slide away from the other chip, on the side its own label is on.
        left = clampX(c.x >= other.c.x ? other.left + other.w + 6 : other.left - w - 6);
      }
      chips.push({ id: a.id, left, top, w, above, c, lost: a.lost });
    }
  }

  const running = view === "running";
  const flatLine: { from: Pt; to: Pt } | null =
    mode === "flat" && dot && open
      ? {
          from: exitCircle(dot, DOT_R + 2, { x: flatX + flatW / 2, y: flatBelow ? flatY : flatY + flatH }),
          to: { x: Math.min(Math.max(dot.x, flatX + 24), flatX + flatW - 24), y: flatBelow ? flatY : flatY + flatH },
        }
      : null;

  const openState: CardState = open ? cardFor(open.id) : { kind: "loading" };
  const openLost = open?.lost ?? false;
  const openVoice = open && voiceState?.id === open.id ? voiceState : null;
  const panelNodes = PANELS.map((id) => (
    <Panel
      key={id}
      id={id}
      setRef={bindPanel[id]}
      state={openState}
      partId={open?.id ?? ""}
      lost={openLost}
      expanded={expanded[id]}
      onToggle={togglePanel}
      onClose={closeNode}
      voice={openVoice}
      speechOk={speechOk}
      onVoice={voiceAction}
    />
  ));

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-black text-white">
      <style>{`@keyframes mm-flow { to { stroke-dashoffset: -28; } }`}</style>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={digitalZoom === 1 ? undefined : { transform: `scale(${digitalZoom})` }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${running ? "opacity-100" : "opacity-0"}`}
      />

      {/* Label outlines, a dot on each label, and lines to the nodes */}
      {running && anchors.length > 0 && size.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          {(open ? [open] : anchors.filter((a) => !a.lost)).map((a) => (
            <polygon
              key={a.id}
              points={a.quad.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="1.25"
              strokeLinejoin="round"
              className={`transition-opacity duration-300 ${a.lost ? "opacity-0" : "opacity-100"}`}
            />
          ))}
          {chips.map((ch) => {
            if (ch.lost) return null;
            const to = { x: Math.min(Math.max(ch.c.x, ch.left + 18), ch.left + ch.w - 18), y: ch.above ? ch.top + CHIP_H : ch.top };
            return (
              <g key={ch.id}>
                <Leader from={exitCircle(ch.c, DOT_R + 2, to)} to={to} />
                <Dot c={ch.c} />
              </g>
            );
          })}
          {open && dot && (
            <g className={`transition-opacity duration-300 ${open.lost ? "opacity-0" : "opacity-100"}`}>
              {mode === "world" &&
                PANELS.map((id) => {
                  const q = panelQuads[id];
                  if (!q) return null;
                  const to = nearestEdgeMid(q, dot!);
                  const from = exitCircle(dot!, DOT_R + 2, to);
                  if (Math.hypot(to.x - from.x, to.y - from.y) < 12) return null;
                  return <Leader key={id} from={from} to={to} />;
                })}
              {flatLine && <Leader from={flatLine.from} to={flatLine.to} />}
              <Dot c={dot} />
            </g>
          )}
        </svg>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="pointer-events-auto flex min-h-11 items-center rounded-ctl bg-black/50 px-4 font-medium backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <ArrowLeft className="mr-2 h-4 w-4" />Machine Memory
        </Link>
        <div role="group" aria-label="View as" className="pointer-events-auto grid grid-cols-2 gap-0.5 rounded-ctl bg-black/50 p-0.5 backdrop-blur">
          {(["operator", "technician"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={role === v}
              onClick={() => selectRole(v)}
              className={`min-h-10 cursor-pointer rounded-[2px] px-3 text-sm font-medium capitalize focus-visible:outline-2 focus-visible:outline-white ${role === v ? "bg-[#ffcd11] text-black" : "text-white"}`}
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
          {error && (
            <p role="alert" className="max-w-xs text-balance text-red-300">
              {error}
            </p>
          )}
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

      {/* Zoom: + and − on the right edge; pinch works too */}
      {running && (
        <div role="group" aria-label="Zoom" className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center rounded-full bg-black/50 p-0.5 backdrop-blur">
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX - 0.01}
            onClick={() => void applyZoom(stepZoom(zoom, 1))}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-2xl leading-none focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-40"
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Zoom ${formatZoom(zoom)}, tap to reset`}
            disabled={zoom <= ZOOM_MIN + 0.01}
            onClick={() => void applyZoom(1)}
            className="min-h-7 cursor-pointer px-1 text-xs font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default"
          >
            {formatZoom(zoom)}
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN + 0.01}
            onClick={() => void applyZoom(stepZoom(zoom, -1))}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-2xl leading-none focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-40"
          >
            −
          </button>
        </div>
      )}

      {/* Hint while nothing is pinned */}
      {running && anchors.length === 0 && (
        <p role="status" className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] text-center text-lg font-medium text-white drop-shadow">
          Point at a part’s label
        </p>
      )}

      {/* Compact nodes: one per label that is not open. Tap to open. */}
      {running &&
        chips.map((ch) => (
          <ChipNode key={ch.id} id={ch.id} left={ch.left} top={ch.top} width={ch.w} lost={ch.lost} state={cardFor(ch.id)} onOpen={openNode} />
        ))}

      {/* Panels on the plane */}
      {running && open && mode === "world" && (
        <div className="absolute inset-0 z-10" aria-label="Part card" role="region">
          {PANELS.map((id, i) => (
            <div key={id} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: PANEL_W, transform: panelTransforms[id] }}>
              {panelNodes[i]}
            </div>
          ))}
        </div>
      )}

      {/* Panels as a flat stack (oblique plane, edge of screen, or label lost) */}
      {running && open && mode === "flat" && (
        <div
          role="region"
          aria-label="Part card"
          className="absolute left-0 top-0 z-10 flex flex-col gap-2 will-change-transform"
          style={{ width: flatW, transform: `translate3d(${flatX}px, ${flatY}px, 0)` }}
        >
          {panelNodes}
        </div>
      )}
    </div>
  );
}

function Dot({ c }: { c: Pt }) {
  return (
    <>
      <circle cx={c.x} cy={c.y} r={DOT_R + 2} fill="rgba(0,0,0,0.35)" />
      <circle cx={c.x} cy={c.y} r={DOT_R} fill="white" />
    </>
  );
}

const shortStatus: Record<Reading["status"], string> = { ok: "OK", watch: "Watch", alert: "Alert" };
const dotColor: Record<Reading["status"], string> = { ok: "bg-emerald-400", watch: "bg-amber-400", alert: "bg-red-500" };

/** Compact node: part name and status. Tapping opens the full panels on that label. */
const ChipNode = memo(function ChipNode({
  id,
  left,
  top,
  width,
  lost,
  state,
  onOpen,
}: {
  id: string;
  left: number;
  top: number;
  width: number;
  lost: boolean;
  state: CardState;
  onOpen: (id: string) => void;
}) {
  const narrow = width < CHIP_W;
  const card = state.kind === "ready" ? state.card : null;
  const status = card ? worstStatus(card.readings) : null;
  const name = card ? card.component.name : state.kind === "missing" ? "Unknown part" : id;
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      aria-label={`Open ${name}`}
      tabIndex={lost ? -1 : 0}
      style={{ ...glassStyle, width, height: CHIP_H, transform: `translate3d(${left}px, ${top}px, 0)` }}
      className={`${glass} absolute left-0 top-0 z-10 flex cursor-pointer items-center gap-2 px-3 text-left will-change-transform transition-opacity duration-500 focus-visible:outline-2 focus-visible:outline-white ${lost ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${status ? dotColor[status] : "bg-white/40"}`} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-tight">{name}</span>
      {narrow ? null : status ? (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${pill[status]}`}>{shortStatus[status]}</span>
      ) : (
        <span className="shrink-0 font-mono text-[10px] text-white/50">{state.kind === "loading" ? "…" : ""}</span>
      )}
    </button>
  );
});

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

const Panel = memo(function Panel({
  id,
  setRef,
  state,
  partId,
  lost,
  expanded,
  onToggle,
  onClose,
  voice,
  speechOk,
  onVoice,
}: {
  id: PanelId;
  setRef: (el: HTMLDivElement | null) => void;
  state: CardState;
  partId: string;
  lost: boolean;
  expanded: boolean;
  onToggle: (id: PanelId) => void;
  onClose: () => void;
  voice: VoiceState | null;
  speechOk: boolean;
  onVoice: (id: string, action: VoiceAction) => void;
}) {
  // Every panel is a tap target: tap to expand in place, tap again to collapse.
  const tappable = {
    role: "button" as const,
    tabIndex: 0,
    "aria-expanded": expanded,
    onClick: () => onToggle(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(id);
      }
    },
  };
  const more = (
    <span aria-hidden="true" className="ml-auto shrink-0 font-mono text-[10px] text-white/50">
      {expanded ? "less ▴" : "more ▾"}
    </span>
  );
  // X on the head panel: closes the card back to a compact node. Stops the
  // tap from reaching the panel underneath, which would toggle expansion.
  const close = (
    <button
      type="button"
      aria-label="Close part card"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 3l10 10M13 3L3 13" />
      </svg>
    </button>
  );
  const href = `/components/${encodeURIComponent(partId)}`;
  const label = (text: string, extra = "") => (
    <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 ${extra}`}>{text}</p>
  );

  if (state.kind !== "ready") {
    if (id !== "head") return <div ref={setRef} className="h-0" aria-hidden="true" />;
    return (
      <div ref={setRef} style={glassStyle} className={`${glass} p-4`} aria-busy={state.kind === "loading"}>
        <div className="flex items-start justify-between gap-3">
          {label(state.kind === "loading" ? `Found ${partId}` : partId)}
          {close}
        </div>
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
              <h2 className="mt-0.5 line-clamp-2 font-display text-[20px] font-semibold leading-tight">{card.component.name}</h2>
              <p className="truncate text-xs text-white/70">{card.component.location}</p>
            </div>
            <div className="flex shrink-0 items-start gap-1.5">
              <span className={`mt-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${pill[status]}`}>
                {lost ? "Last seen" : statusWord[status]}
              </span>
              {close}
            </div>
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
        <p className={`mt-1 font-display text-[17px] font-semibold leading-snug ${expanded ? "" : "line-clamp-3"}`}>{card.next_step}</p>
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
      {voice ? (
        <VoiceBox voice={voice} onVoice={onVoice} />
      ) : (
        <div className="mt-3 flex gap-2">
          {speechOk && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoice(partId, "start");
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className={`${primaryBtn} flex-1`}
            >
              <MicIcon />
              Speak a note
            </button>
          )}
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className={speechOk ? ghostBtn : `${primaryBtn} flex-1`}
          >
            {speechOk ? "Full card →" : expanded ? "Add a note →" : "History & add a note →"}
          </Link>
        </div>
      )}
    </div>
  );
});

const primaryBtn =
  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60";
const ghostBtn =
  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/30 px-4 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
      <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2M5.5 14.5h5" />
    </svg>
  );
}

/** The spoken-note strip at the foot of the memory panel: listening, review, saving, saved, or error. */
function VoiceBox({ voice, onVoice }: { voice: VoiceState; onVoice: (id: string, action: VoiceAction) => void }) {
  const { id, phase } = voice;
  const act = (action: VoiceAction) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onVoice(id, action);
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const quote = (voice.text || voice.interim) && (
    <p className="mt-2 text-[15px] leading-snug text-white">
      {voice.text}
      {voice.interim && <span className="text-white/55">{voice.text ? " " : ""}{voice.interim}</span>}
    </p>
  );
  return (
    <div className="mt-3 cursor-default rounded-xl bg-black/35 p-3 ring-1 ring-white/15" onClick={stop} onKeyDown={stop} role="group" aria-label="Spoken note">
      {phase === "listening" && (
        <>
          <p role="status" className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Listening… say what you noticed
          </p>
          {quote}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={act("stop")} className={`${primaryBtn} flex-1`}>Done</button>
            <button type="button" onClick={act("cancel")} className={ghostBtn}>Cancel</button>
          </div>
        </>
      )}
      {(phase === "review" || phase === "saving") && (
        <>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{phase === "saving" ? "Saving…" : "Heard"}</p>
          {quote}
          {voice.message && <p role="alert" className="mt-2 text-[12px] text-red-200">{voice.message}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={act("save")} disabled={phase === "saving"} aria-busy={phase === "saving"} className={`${primaryBtn} flex-1`}>
              {phase === "saving" ? "Saving note…" : "Save note"}
            </button>
            <button type="button" onClick={act("start")} disabled={phase === "saving"} aria-label="Say it again" className={ghostBtn}><MicIcon /></button>
            <button type="button" onClick={act("cancel")} disabled={phase === "saving"} className={ghostBtn}>Cancel</button>
          </div>
        </>
      )}
      {phase === "saved" && (
        <>
          <p role="status" className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">{voice.message}</p>
          {quote}
        </>
      )}
      {phase === "error" && (
        <>
          <p role="alert" className="text-[13px] leading-snug text-amber-100">{voice.message}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={act("start")} className={`${primaryBtn} flex-1`}><MicIcon />Try again</button>
            <button type="button" onClick={act("cancel")} className={ghostBtn}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
