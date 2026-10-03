import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return <svg {...base} className={className}><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
}
export function ArrowLeft({ className = "h-4 w-4" }: { className?: string }) {
  return <svg {...base} className={className}><path d="M16 10H4M9 5l-5 5 5 5" /></svg>;
}
export function ChevronDown({ className = "h-4 w-4" }: { className?: string }) {
  return <svg {...base} className={className}><path d="M5 8l5 5 5-5" /></svg>;
}
export function Mic({ className = "h-4 w-4" }: { className?: string }) {
  return <svg {...base} className={className}><rect x="7" y="2.5" width="6" height="10" rx="3" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" /></svg>;
}
export function Close({ className = "h-4 w-4" }: { className?: string }) {
  return <svg {...base} className={className}><path d="M5 5l10 10M15 5L5 15" /></svg>;
}
export function Camera({ className = "h-4 w-4" }: { className?: string }) {
  return <svg {...base} className={className}><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2l1.2-1.8h4.6L13.5 6h2A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" /><circle cx="10" cy="10.5" r="2.75" /></svg>;
}
