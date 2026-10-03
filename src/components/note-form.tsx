"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MachineEvent, NewNoteRequest, NewNoteResponse, Role } from "@/lib/types";

// Browser speech recognition is not included in TypeScript's DOM types.
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
function speechConstructor() {
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
const subscribe = () => () => {};
const speechSupported = () => Boolean(speechConstructor());
const serverSpeechSupported = () => false;
const buttonStyle = "min-h-14 cursor-pointer rounded-full px-6 py-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50";

export default function NoteForm({ id, role, onSaved, onCheckHistory }: {
  id: string; role: Role; onSaved: (event: MachineEvent) => void; onCheckHistory: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const pendingRoleChange = useRef<(() => void) | null>(null);
  const supported = useSyncExternalStore(subscribe, speechSupported, serverSpeechSupported);
  const recognition = useRef<Recognition | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!text && !saving && !listening) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const warnForLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(`${url.pathname}${url.search}${url.hash}`);
    };
    const warnForRole = (event: Event) => {
      event.preventDefault();
      pendingRoleChange.current = (event as CustomEvent<{ apply: () => void }>).detail.apply;
      setLeaveHref("#role-change");
    };
    window.addEventListener("machine-memory:before-role-change", warnForRole);
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnForLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("machine-memory:before-role-change", warnForRole);
      document.removeEventListener("click", warnForLink, true);
    };
  }, [text, saving, listening]);

  useEffect(() => {
    if (leaveHref) leaveDialog.current?.showModal();
    else leaveDialog.current?.close();
  }, [leaveHref]);

  function dictate() {
    if (busy.current) return;
    if (recognition.current) { recognition.current.stop(); return; }
    const Speech = speechConstructor();
    if (!Speech) return;
    const current = new Speech();
    current.lang = "en-US";
    current.continuous = false;
    current.interimResults = false;
    current.onresult = (event) => {
      const words: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        if (event.results[index].isFinal) words.push(event.results[index][0].transcript);
      }
      if (words.length) {
        setText(previous => [previous.trim(), words.join(" ").trim()].filter(Boolean).join(" "));
        setSaved(false); setInvalid(false);
      }
    };
    current.onerror = (event) => {
      setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was denied. You can type your note below."
        : "Dictation didn’t finish. Keep what was captured, type your note, or try dictating again.");
    };
    current.onend = () => { recognition.current = null; setListening(false); field.current?.focus(); };
    recognition.current = current;
    setVoiceError(""); setListening(true);
    try { current.start(); } catch {
      recognition.current = null; setListening(false);
      setVoiceError("Dictation isn’t available right now. Type your note below.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || recognition.current) return;
    const trimmed = text.trim();
    if (!trimmed) { setInvalid(true); setError("Write or dictate a note before saving."); field.current?.focus(); return; }
    busy.current = true;
    setSaving(true); setError(""); setInvalid(false); setUncertain(false); setSaved(false);
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const body: NewNoteRequest = { text: trimmed, author_role: role };
      const response = await fetch(`/api/components/${encodeURIComponent(id)}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal,
      });
      if (!mounted.current) return;
      if (response.status === 400 || response.status === 404) {
        setError(response.status === 404 ? "This part is no longer available. Your note is still here; scan a known part to continue." : "The note wasn’t accepted. Review the text and try again.");
        return;
      }
      if (!response.ok) throw new Error("Save not confirmed");
      const data: NewNoteResponse = await response.json();
      if (!data.event?.id) throw new Error("Save not confirmed");
      if (!mounted.current) return;
      setText(""); setSaved(true);
      setLeaveHref(null);
      onSaved(data.event);
    } catch {
      if (mounted.current) {
        setUncertain(true);
        setError("We couldn’t confirm whether this note was saved. Check recent history before saving again to avoid a duplicate. Your text is still here.");
      }
    } finally {
      window.clearTimeout(timeout);
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <section aria-labelledby="note-heading" className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <dialog ref={leaveDialog} onCancel={event => { event.preventDefault(); setLeaveHref(null); }} aria-labelledby="leave-note-heading" aria-describedby="leave-note-description" className="m-auto w-[calc(100%-3rem)] max-w-sm rounded-xl border border-neutral-300 bg-white p-6 text-neutral-950 backdrop:bg-black/50 dark:bg-neutral-950 dark:text-neutral-100">
        <h2 id="leave-note-heading" className="text-xl font-semibold">{saving ? "Your note is saving" : "Leave this note?"}</h2>
        <p id="leave-note-description" className="mt-3">{saving ? "Wait for the save to finish before leaving this part." : "Your unsaved text will be lost if you continue."}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={() => setLeaveHref(null)} className={`${buttonStyle} bg-black text-white dark:bg-white dark:text-black`}>Keep working</button>
          <button type="button" disabled={saving} onClick={() => { if (leaveHref) { const href = leaveHref; setLeaveHref(null); if (href === "#role-change") pendingRoleChange.current?.(); else router.push(href); } }} className={`${buttonStyle} border border-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800`}>{leaveHref === "#role-change" ? "Discard note and switch role" : "Leave without saving"}</button>
        </div>
      </dialog>
      <h2 id="note-heading" className="text-lg font-semibold">Leave a note</h2>
      <p id="note-help" className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Record what you noticed or worked on for the next person. Saving as {role}.</p>
      <form noValidate onSubmit={save} className="mt-4 flex flex-col gap-3">
        {supported ? <button type="button" onClick={dictate} disabled={saving} aria-pressed={listening} className={`${buttonStyle} border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800`}>
          {listening ? "Stop dictation" : "Dictate note"}
        </button> : <p className="text-sm text-neutral-600 dark:text-neutral-300">Type your note below. Voice dictation isn’t available in this browser.</p>}
        <p role="status" className="min-h-5 text-sm text-neutral-600 dark:text-neutral-300">{listening ? "Listening… Stop dictation to review and save." : supported ? "Review dictated text before saving." : ""}</p>
        {voiceError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{voiceError}</p>}
        <label htmlFor="inspection-note" className="font-medium">Inspection note</label>
        <textarea ref={field} id="inspection-note" value={text} onChange={event => { setText(event.target.value); setSaved(false); setInvalid(false); }} readOnly={listening || saving} rows={6} aria-invalid={invalid} aria-describedby={`note-help${error ? " note-error" : ""}`} className="min-h-40 w-full resize-none rounded-lg border border-neutral-400 bg-transparent p-3 leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 read-only:opacity-70 dark:border-neutral-600" />
        {error && <p id="note-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        {uncertain && <button type="button" onClick={onCheckHistory} className={`${buttonStyle} border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800`}>Check recent history</button>}
        <button type="submit" disabled={saving || listening} aria-busy={saving} className={`${buttonStyle} bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200`}>{saving ? "Saving note…" : "Save note"}</button>
        <p role="status" className="min-h-6 text-sm text-green-800 dark:text-green-300">{saved ? "Note saved to this part’s history." : ""}</p>
      </form>
    </section>
  );
}
