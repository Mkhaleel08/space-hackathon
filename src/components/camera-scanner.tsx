"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Html5Qrcode } from "html5-qrcode";

type CameraState = "idle" | "opening" | "running" | "stopping" | "error";

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

export default function CameraScanner() {
  const router = useRouter();
  const scanAccepted = useRef(false);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState("");
  const [componentId, setComponentId] = useState("");
  const scanner = useRef<Html5Qrcode | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Permission may resolve after navigation; release that stream too.
      void (async () => {
        await pending.current;
        const current = scanner.current;
        if (current?.isScanning) await current.stop();
        current?.clear();
      })().catch(() => {});
    };
  }, []);

  async function openCamera() {
    if (busy.current || scanner.current?.isScanning) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access needs a secure connection. Open the HTTPS preview URL in Safari or Chrome on your phone.");
      setState("error");
      return;
    }
    busy.current = true;
    setError("");
    setComponentId("");
    scanAccepted.current = false;
    setState("opening");
    const operation = (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!mounted.current) return;
        const current = new Html5Qrcode("component-camera", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scanner.current = current;
        await current.start(
          { facingMode: "environment" },
          { fps: 10 },
          (text) => { void handleScan(text); },
          () => {},
        );
        if (mounted.current) setState("running");
      } catch (cause) {
        try { scanner.current?.clear(); } catch { /* Preserve the camera error. */ }
        scanner.current = null;
        if (mounted.current) {
          setError(cameraError(cause));
          setState("error");
        }
      } finally {
        busy.current = false;
      }
    })();
    pending.current = operation;
    await operation;
  }

  async function stopCamera() {
    if (busy.current) return false;
    busy.current = true;
    setError("");
    setState("stopping");
    const operation = (async () => {
      try {
        if (scanner.current?.isScanning) await scanner.current.stop();
        scanner.current?.clear();
        scanner.current = null;
        if (mounted.current) setState("idle");
        return true;
      } catch {
        if (mounted.current) {
          setError("The camera could not stop. Close this tab to release it.");
          setState("running");
        }
        return false;
      } finally {
        busy.current = false;
      }
    })();
    pending.current = operation.then(() => {});
    return await operation;
  }

  async function handleScan(text: string) {
    if (!mounted.current || busy.current || scanAccepted.current || !text) return;
    scanAccepted.current = true;
    setComponentId(text);
    const stopped = await stopCamera();
    if (stopped && mounted.current) {
      router.push(`/c/${encodeURIComponent(text)}`);
    } else {
      scanAccepted.current = false;
    }
  }

  const active = state === "running" || state === "stopping";
  const waiting = state === "opening" || state === "stopping";

  return (
    <section aria-label="Component camera" className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] max-h-[45svh] overflow-hidden rounded-xl bg-neutral-900">
        <div id="component-camera" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {!active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-neutral-200">
            {state === "opening" ? "Allow camera access when your browser asks." : "Your camera preview will appear here."}
          </div>
        )}
      </div>
      <p role="status" className="min-h-12 break-words text-neutral-600 dark:text-neutral-300">
        {state === "opening" ? "Opening camera…" : state === "stopping" ? "Stopping camera…" : active ? componentId ? `Detected component: ${componentId}` : "Camera is ready. Hold a QR code in view." : "Tap Open camera to begin."}
      </p>
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      <button
        type="button"
        onClick={active ? stopCamera : openCamera}
        disabled={waiting}
        aria-busy={waiting}
        className="min-h-14 cursor-pointer rounded-full bg-black px-6 py-4 text-lg font-medium text-white hover:bg-neutral-800 active:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {active ? "Stop camera" : state === "error" ? "Try camera again" : "Open camera"}
      </button>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Your rear camera is used when available. Tap Stop camera when you finish scanning.
      </p>
    </section>
  );
}
