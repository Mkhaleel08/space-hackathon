/**
 * Browser speech recognition, which is not in TypeScript's DOM types.
 * Shared by the live view's spoken notes and the part assistant.
 */
export type Recognition = {
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

export function speechConstructor() {
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const speechSupported = () => Boolean(speechConstructor());

/** What to tell the user when recognition stops with an error. */
export function speechErrorMessage(error: string, typedHint: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") return `Microphone access was denied. ${typedHint}`;
  if (error === "no-speech") return "Didn’t catch anything. Tap the mic and try again.";
  if (error === "audio-capture") return `The phone wouldn’t share the microphone. ${typedHint}`;
  if (error === "network") return `Dictation is turned off on this phone. Turn on Enable Dictation in Settings › General › Keyboard, or ${typedHint.charAt(0).toLowerCase()}${typedHint.slice(1)}`;
  return `Dictation stopped early (${error}). Tap the mic to try again.`;
}
