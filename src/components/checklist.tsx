"use client";

import type { ChecklistItem } from "@/lib/types";

/**
 * The card's inspection checklist. Tap a row to check it; "Finish inspection"
 * files the checked and skipped steps as one note through the normal notes
 * path, so it lands in history like anything else the tech says. Checked state
 * is the caller's: it lives on the phone for the session and nowhere else.
 */
export default function Checklist({
  items,
  checked,
  onToggle,
  onFinish,
  saving,
  dark = false,
}: {
  items: ChecklistItem[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  onFinish: () => void;
  saving: boolean;
  /** Camera-glass styling for the live view. */
  dark?: boolean;
}) {
  if (items.length === 0) return null;
  const row = dark
    ? "border-white/15 text-white hover:bg-white/10"
    : "border-line text-foreground hover:bg-surface";
  const box = dark ? "border-white/50" : "border-foreground/60";
  const muted = dark ? "text-white/50" : "text-muted";
  const finish = dark
    ? "bg-[#ffcd11] text-black hover:bg-[#f0bf0a]"
    : "bg-accent text-accent-ink hover:bg-[#f0bf0a]";
  const done = items.filter((i) => checked.has(i.id)).length;
  return (
    <div className={dark ? "mt-3" : "mt-5"}>
      <div className={`flex items-baseline justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>
        <span>Inspection checklist</span>
        <span>
          {done} of {items.length}
        </span>
      </div>
      <ul className="mt-1.5" aria-label="Inspection checklist">
        {items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => onToggle(item.id)}
                className={`flex min-h-12 w-full cursor-pointer items-center gap-3 border-b py-2 text-left text-[14px] leading-snug focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ffcd11] ${row}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${isChecked ? "border-[#ffcd11] bg-[#ffcd11] text-black" : box}`}
                >
                  {isChecked && (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  )}
                </span>
                <span className={isChecked ? `line-through ${muted}` : ""}>{item.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onFinish}
        disabled={done === 0 || saving}
        aria-busy={saving}
        className={`mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${finish}`}
      >
        {saving ? "Filing inspection…" : done === 0 ? "Check a step to finish" : done === items.length ? "Finish inspection" : `Finish inspection (${items.length - done} skipped)`}
      </button>
    </div>
  );
}

/** The note text a finished checklist files. */
export function checklistNoteText(items: ChecklistItem[], checked: Set<string>): string {
  const done = items.filter((i) => checked.has(i.id)).map((i) => i.text);
  const skipped = items.filter((i) => !checked.has(i.id)).map((i) => i.text);
  return `Inspection checklist completed. Checked: ${done.join("; ")}.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`;
}
