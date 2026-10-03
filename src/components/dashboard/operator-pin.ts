// The operator PIN lives in sessionStorage for the tab, never in a cookie or
// the URL. Every helper tolerates storage being unavailable.
const KEY = "machine-memory:operator-pin";

export function loadPin(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePin(pin: string) {
  try {
    window.sessionStorage.setItem(KEY, pin);
  } catch { /* Session-only fallback: the user retypes it next time. */ }
}

export function forgetPin() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch { /* Nothing stored. */ }
}
