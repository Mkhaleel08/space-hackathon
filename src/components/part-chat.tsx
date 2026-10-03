"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentCard, Reading, Role } from "@/lib/types";
import { READINGS_HEADER, type ChatMessage, type ChatRequest, type ReadingChange, type ReadingsUpdated } from "@/lib/chat";
import { speechConstructor, speechErrorMessage, type Recognition } from "@/lib/speech";

/**
 * The part assistant: a chat drawer over the live view, opened from the mic
 * button beside a part's card. The tech talks (or types), the backend's
 * model answers from the part's history and readings, and the reply streams
 * in and is read aloud when the question was spoken. Works like a retail
 * site's chat widget: one button, then a full window.
 */

/** Camera hooks from the live view. iOS Safari will not share the mic while the page holds the camera. */
export type CameraControl = {
  pause: () => void;
  resume: () => void;
  isOn: () => boolean;
  micNeedsCamera: { current: boolean };
};

type Phase = "idle" | "listening" | "thinking" | "streaming";

const SUGGESTIONS = ["What could be causing this?", "What should I check first?", "Anything in the history to worry about?"];
const TYPED_HINT = "Type your question below instead.";

const pill: Record<Reading["status"], string> = {
  ok: "bg-emerald-400/20 text-emerald-200 ring-emerald-300/40",
  watch: "bg-amber-400/20 text-amber-100 ring-amber-300/50",
  alert: "bg-red-500/25 text-red-100 ring-red-300/50",
};
const statusWord: Record<Reading["status"], string> = { ok: "Running normal", watch: "Watch closely", alert: "Needs attention" };

function worstStatus(readings: Reading[]): Reading["status"] {
  if (readings.some((r) => r.status === "alert")) return "alert";
  if (readings.some((r) => r.status === "watch")) return "watch";
  return "ok";
}

const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export default function PartChat({
  card,
  role,
  messages,
  onMessages,
  onReadings,
  landscape,
  speechOk,
  camera,
  onClose,
}: {
  card: ComponentCard;
  role: Role;
  messages: ChatMessage[];
  onMessages: (next: ChatMessage[]) => void;
  /** The server recorded a measurement from this turn; here is the part's full list after it. */
  onReadings: (readings: Reading[]) => void;
  landscape: boolean;
  speechOk: boolean;
  camera: CameraControl;
  onClose: () => void;
}) {
  const id = card.component.id;
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [readAloud, setReadAloud] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const stopSpeaking = () => {
    if (canSpeak()) window.speechSynthesis.cancel();
  };
  const say = (text: string) => {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  };

  const dropRecognition = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.abort();
  }, []);

  // Keep the newest message in view as it streams. Not on open: the intro should read first.
  useEffect(() => {
    const el = listRef.current;
    if (el && (messages.length > 0 || phase !== "idle")) el.scrollTop = el.scrollHeight;
  }, [messages, phase, interim]);

  // Leaving the chat: stop listening, stop talking, stop the reply, give the camera back.
  useEffect(() => {
    return () => {
      dropRecognition();
      abortRef.current?.abort();
      if (canSpeak()) window.speechSynthesis.cancel();
      camera.resume();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (raw: string, spoken: boolean) => {
      const text = raw.trim();
      if (!text || phaseRef.current === "thinking" || phaseRef.current === "streaming") return;
      stopSpeaking();
      setError("");
      setDraft("");
      let thread: ChatMessage[] = [...messagesRef.current, { role: "user", content: text }];
      onMessages(thread);
      setPhase("thinking");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const body: ChatRequest = { messages: thread, author_role: role };
        const res = await fetch(`/api/components/${encodeURIComponent(id)}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error || "The assistant couldn’t answer. Try again.");
        }
        // A stated measurement was recorded server-side: patch the card and
        // pin the change to this turn. A bad header never blocks the answer.
        const raw = res.headers.get(READINGS_HEADER);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ReadingsUpdated;
            if (Array.isArray(parsed.changes) && Array.isArray(parsed.readings) && parsed.changes.length > 0) {
              const changes: ReadingChange[] = parsed.changes;
              thread = [...thread.slice(0, -1), { role: "user", content: text, changes }];
              onMessages(thread);
              onReadings(parsed.readings);
            }
          } catch {
            /* answer still shows */
          }
        }
        setPhase("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        onMessages([...thread, { role: "assistant", content: "" }]);
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          onMessages([...thread, { role: "assistant", content: acc }]);
        }
        acc = (acc + decoder.decode()).trim();
        if (!acc) throw new Error("The assistant had nothing to say. Try asking another way.");
        onMessages([...thread, { role: "assistant", content: acc }]);
        if (spoken && readAloud) say(acc);
      } catch (cause) {
        if (ctrl.signal.aborted) return;
        onMessages(thread);
        setError(cause instanceof Error ? cause.message : "The assistant couldn’t answer. Try again.");
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setPhase("idle");
      }
    },
    [id, role, readAloud, onMessages, onReadings],
  );

  // Tap the mic: listen until the person stops talking, then send what was heard.
  const listen = useCallback(() => {
    const Speech = speechConstructor();
    if (!Speech) return;
    stopSpeaking();
    dropRecognition();
    setError("");
    if (camera.micNeedsCamera.current) camera.pause();
    const rec = new Speech();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    let lastInterim = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = [finalText, r[0].transcript].join(" ").trim();
        else text += r[0].transcript;
      }
      lastInterim = text.trim();
      setInterim([finalText, lastInterim].filter(Boolean).join(" "));
    };
    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      const denied = e.error === "not-allowed" || e.error === "service-not-allowed";
      // First failure with the camera open: assume the mic is held by the
      // camera (iOS), release it, and try once more without asking.
      if (!denied && e.error !== "no-speech" && !camera.micNeedsCamera.current && camera.isOn()) {
        camera.micNeedsCamera.current = true;
        camera.pause();
        window.setTimeout(() => {
          if (phaseRef.current === "listening") listenRef.current();
        }, 350);
        return;
      }
      camera.resume();
      setPhase("idle");
      setInterim("");
      setError(speechErrorMessage(e.error, TYPED_HINT));
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      camera.resume();
      const text = (finalText || lastInterim).trim();
      setInterim("");
      setPhase("idle");
      if (text) void send(text, true);
      else setError("Didn’t catch anything. Tap the mic and try again.");
    };
    recRef.current = rec;
    setInterim("");
    setPhase("listening");
    try {
      rec.start();
    } catch {
      recRef.current = null;
      camera.resume();
      setPhase("idle");
      setError(`Dictation isn’t available right now. ${TYPED_HINT}`);
    }
  }, [camera, dropRecognition, send]);
  const listenRef = useRef(listen);
  listenRef.current = listen;

  const stopListening = () => recRef.current?.stop();

  const status = worstStatus(card.readings);
  const busy = phase === "thinking" || phase === "streaming";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      role="dialog"
      aria-label={`Ask about ${card.component.name}`}
      onClick={stop}
      onKeyDown={stop}
      className={`fixed z-30 flex flex-col overflow-hidden border-white/15 bg-[rgba(12,16,24,0.9)] text-white shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl ${
        landscape
          ? "inset-y-0 right-0 w-[min(400px,58vw)] border-l pr-[env(safe-area-inset-right)]"
          : "inset-x-0 bottom-0 h-[78dvh] rounded-t-3xl border-t"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffcd11]">Part assistant</p>
          <h2 className="mt-0.5 truncate text-[17px] font-semibold leading-tight">{card.component.name}</h2>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-white/60">
            <span className="truncate">{card.asset.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${pill[status]}`}>{statusWord[status]}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canSpeak() && (
            <button
              type="button"
              aria-pressed={readAloud}
              aria-label={readAloud ? "Read replies aloud: on" : "Read replies aloud: off"}
              onClick={() => {
                if (readAloud) stopSpeaking();
                setReadAloud((v) => !v);
              }}
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white ${readAloud ? "text-[#ffcd11]" : "text-white/50"}`}
            >
              <SpeakerIcon muted={!readAloud} />
            </button>
          )}
          <button
            type="button"
            aria-label="Close assistant"
            onClick={onClose}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" aria-live="polite">
        <div className="mr-8 rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2.5 text-[14px] leading-snug">
          Ask me about this {card.component.name.toLowerCase()}. I know its history and the readings on the card. Possible causes, what to check, what to change. Tap the mic and ask.
        </div>
        {messages.length === 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => void send(s, false)}
                  disabled={busy}
                  className="min-h-10 cursor-pointer rounded-full border border-white/25 px-3.5 text-[13px] font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`mt-2.5 whitespace-pre-wrap text-[14px] leading-snug ${
              m.role === "user"
                ? "ml-8 rounded-2xl rounded-tr-md bg-[#ffcd11] px-3.5 py-2.5 text-black"
                : "mr-8 rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2.5"
            }`}
          >
            {m.content}
            {m.role === "user" && m.changes && m.changes.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Readings updated">
                {m.changes.map((c) => (
                  <li key={c.label} className="rounded-full bg-black/85 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#ffcd11] ring-1 ring-black/40">
                    {c.label} {c.from} → {c.to} · {c.status}
                  </li>
                ))}
              </ul>
            )}
            {m.role === "assistant" && phase === "streaming" && i === messages.length - 1 && (
              <span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-[#ffcd11]" />
            )}
          </div>
        ))}
        {phase === "thinking" && (
          <div role="status" className="mr-8 mt-2.5 flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-3">
            <span className="sr-only">Thinking</span>
            {[0, 150, 300].map((d) => (
              <span key={d} aria-hidden="true" className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        {phase === "listening" && (
          <div role="status" className="ml-8 mt-2.5 rounded-2xl rounded-tr-md bg-[#ffcd11]/30 px-3.5 py-2.5 text-[14px] leading-snug ring-1 ring-[#ffcd11]/60">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffcd11]">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Listening…
            </p>
            {interim && <p className="mt-1 text-white">{interim}</p>}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2.5 text-[13px] leading-snug text-amber-100">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft, false);
        }}
        className="flex items-center gap-2 border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      >
        {speechOk && (
          <button
            type="button"
            onClick={phase === "listening" ? stopListening : listen}
            disabled={busy}
            aria-label={phase === "listening" ? "Stop listening" : "Ask by voice"}
            aria-pressed={phase === "listening"}
            className={`relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50 ${
              phase === "listening" ? "bg-red-500 text-white" : "bg-[#ffcd11] text-black hover:bg-[#f0bf0a]"
            }`}
          >
            {phase === "listening" && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-red-500/50" />}
            <MicIcon size={22} />
          </button>
        )}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={phase === "listening" ? "Listening…" : speechOk ? "Or type a question" : "Type a question"}
          enterKeyHint="send"
          autoComplete="off"
          disabled={phase === "listening"}
          aria-label="Your question"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-white/20 bg-black/30 px-4 text-[15px] text-white placeholder:text-white/40 focus:border-[#ffcd11] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
      <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2M5.5 14.5h5" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
      {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
    </svg>
  );
}
