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
        className="min-h-14 cursor-pointer rounded-full bg-white px-8 py-4 text-lg font-medium text-black hover:bg-neutral-200"
      >
        Try again
      </button>
      <Link href="/scan" className="flex min-h-11 items-center text-sm text-neutral-300 underline underline-offset-4">
        Use the simple scanner instead
      </Link>
    </main>
  );
}
