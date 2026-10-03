import Link from "next/link";
import CameraScanner from "@/components/camera-scanner";

export const metadata = { title: "Scan a part | Machine Memory" };

export default function ScanPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6">
      <Link href="/" className="flex min-h-11 w-fit items-center rounded underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4">
        Machine Memory
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Scan a part</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">
          Open your camera and point it at a component’s QR code.
        </p>
      </header>
      <CameraScanner />
      <section aria-labelledby="choose-part-heading">
        <h2 id="choose-part-heading" className="text-lg font-semibold">Or choose a part</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Open its history without using the camera.</p>
        <ul className="mt-3 grid gap-2">
          {[
            ["hyd-pump", "Main hydraulic pump"],
            ["boom-cyl", "Boom cylinder"],
            ["engine-air", "Engine air filter"],
            ["track-left", "Left track and final drive"],
          ].map(([id, name]) => (
            <li key={id}>
              <Link href={`/components/${id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-neutral-300 px-4 py-3 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-800">
                <span>{name}</span><span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
