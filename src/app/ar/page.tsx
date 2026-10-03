import type { Viewport } from "next";
import ArView from "@/components/ar-view";

export const metadata = { title: "Live view | Machine Memory" };

// Edge to edge so the camera fills the screen in landscape; the view pads
// its own controls with the safe-area insets.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function ArPage() {
  return <ArView />;
}
