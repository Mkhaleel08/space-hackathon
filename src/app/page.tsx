import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold">Machine Memory</h1>
      <p className="max-w-sm text-balance text-neutral-600 dark:text-neutral-300">
        Point your camera at a component. See what the machine remembers.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/ar"
          className="flex min-h-14 items-center justify-center rounded-full bg-black px-8 py-4 text-lg font-medium text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Live view
        </Link>
        <Link
          href="/scan"
          className="flex min-h-14 items-center justify-center rounded-full border border-neutral-300 px-8 py-4 text-lg font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Scan a part
        </Link>
      </div>
    </main>
  );
}
