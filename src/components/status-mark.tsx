import { LEVEL_LABEL, LEVEL_TONE, type Level } from "./dashboard/status";

/** A dot and a word. The same mark on the card, the dashboard and the live view chips. */
export default function StatusMark({ level, label, className = "" }: { level: Level; label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap font-medium ${LEVEL_TONE[level]} ${className}`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${level === "none" ? "border border-current" : "bg-current"}`} />
      {label ?? LEVEL_LABEL[level]}
    </span>
  );
}
