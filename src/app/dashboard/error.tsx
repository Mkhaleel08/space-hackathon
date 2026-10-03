"use client";

import Link from "next/link";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Couldn’t load the dashboard</h1>
      <p role="alert" className="text-neutral-600 dark:text-neutral-300">The machine history may be temporarily unavailable. Check the connection and try again.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="min-h-14 cursor-pointer rounded-full bg-black px-6 font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 dark:bg-white dark:text-black dark:hover:bg-neutral-200">Try again</button>
        <Link href="/" className="flex min-h-14 items-center rounded-full border border-neutral-300 px-6 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-neutral-700 dark:hover:bg-neutral-800">Home</Link>
      </div>
    </main>
  );
}
