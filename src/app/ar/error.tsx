"use client";

import Link from "next/link";

export default function ArError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 bg-black p-8 text-center text-white">
      <h1 className="text-2xl font-semibold">Live view hit a snag</h1>
      <p className="max-w-sm break-words font-mono text-xs text-red-300">{error.message || "Unknown error"}</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-ctl bg-accent px-8 text-lg font-medium text-accent-ink hover:bg-[#f0bf0a]"
      >
        Try again
      </button>
      <Link href="/dashboard" className="flex min-h-11 items-center text-sm text-neutral-300 underline underline-offset-4">
        Browse parts instead
      </Link>
    </main>
  );
}
