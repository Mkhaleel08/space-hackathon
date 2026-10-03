"use client";

import { btnPrimary } from "@/components/ui";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btnPrimary}>
      Print
    </button>
  );
}
