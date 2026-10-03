import Link from "next/link";
import CameraScanner from "@/components/camera-scanner";
import { ArrowLeft } from "@/components/icons";
import { h1, h2, meta, section } from "@/components/ui";

export const metadata = { title: "Scan a part | Machine Memory" };

const PARTS = [
  ["hyd-pump", "Main hydraulic pump"],
  ["boom-cyl", "Boom cylinder"],
  ["engine-air", "Engine air filter"],
  ["track-left", "Left track and final drive"],
] as const;

export default function ScanPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-10 px-6 py-6 sm:py-10">
      <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft /> Machine Memory
      </Link>
      <header>
        <h1 className={h1}>Scan a part</h1>
        <p className={`${meta} mt-2 text-base`}>Open the camera and point it at the label on the part.</p>
      </header>
      <CameraScanner />
      <section aria-labelledby="choose-part-heading" className={section}>
        <h2 id="choose-part-heading" className={h2}>Or choose a part</h2>
        <p className={`${meta} mt-1`}>Open its history without the camera.</p>
        <ul className="mt-4 border-t border-line">
          {PARTS.map(([id, name]) => (
            <li key={id} className="border-b border-line">
              <Link href={`/components/${id}`} className="flex min-h-14 items-center py-3 font-medium transition-colors duration-150 hover:text-muted">
                {name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
