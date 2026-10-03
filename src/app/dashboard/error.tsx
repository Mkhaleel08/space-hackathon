"use client";

import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { btnGhost, btnPrimary, h1 } from "@/components/ui";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
    <SiteHeader active="dashboard" />
    <main id="main-content" className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-6 py-10">
      <h1 className={h1}>Couldn’t load the dashboard</h1>
      <p role="alert" className="max-w-[50ch] text-muted">The machine history may be temporarily unavailable. Check the connection and try again.</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={btnPrimary}>Try again</button>
        <Link href="/" className={btnGhost}>Home</Link>
      </div>
    </main>
    </>
  );
}
