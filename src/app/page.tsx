import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold">Machine Memory</h1>
      <p className="max-w-sm text-balance text-neutral-600">
        Point your camera at a component. See what the machine remembers.
      </p>
      <Link
        href="/scan"
        className="rounded-full bg-black px-8 py-4 text-lg font-medium text-white"
      >
        Scan a part
      </Link>
    </main>
  );
}
