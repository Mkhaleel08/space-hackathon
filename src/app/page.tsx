import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { btnPrimary, btnSecondary } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-16 pt-[16svh] sm:pt-[22svh]">
      <h1 className="text-[2.25rem] font-semibold leading-none tracking-tight sm:text-[2.75rem]">Machine Memory</h1>
      <p className="mt-5 max-w-sm text-balance text-lg leading-snug text-muted">
        Point your camera at a part. See what the machine remembers.
      </p>

      <nav aria-label="Start" className="mt-14 flex flex-col gap-3">
        <Link href="/ar" className={`${btnPrimary} min-h-14 text-lg`}>
          Live view
        </Link>
        <Link href="/scan" className={`${btnSecondary} min-h-14 text-lg`}>
          Scan a part
        </Link>
      </nav>

      <div className="mt-16 border-t border-line pt-5">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 font-medium hover:text-muted">
          Operator dashboard <ArrowRight />
        </Link>
        <p className="mt-0.5 text-sm text-muted">Every asset, every part, the recent notes.</p>
      </div>
    </main>
  );
}
