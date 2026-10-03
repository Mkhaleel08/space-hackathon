import Link from "next/link";
import CameraScanner from "@/components/camera-scanner";
import { ArrowRight } from "@/components/icons";
import SiteHeader from "@/components/site-header";
import s from "@/components/workspace.module.css";

export const metadata = { title: "Scan a part | Machine Memory" };

const PARTS = [
  ["hyd-pump", "Main hydraulic pump"],
  ["boom-cyl", "Boom cylinder"],
  ["engine-air", "Engine air filter"],
  ["track-left", "Left track and final drive"],
] as const;

export default function ScanPage() {
  return (
    <>
      <SiteHeader active="scan" />
      <main id="main-content" className={s.scanPage}>
        <header className={s.pageHeading}>
          <div>
            <p className={s.eyebrow}>At the machine</p>
            <h1>Find the part. Know its story.</h1>
            <p>
              Scan a QR label to open the part’s history. For AprilTags, use{" "}
              <Link href="/ar" className="underline underline-offset-4">
                live view
              </Link>
              .
            </p>
          </div>
        </header>
        <div className={s.scanColumns}>
          <CameraScanner />
          <section
            aria-labelledby="choose-part-heading"
            className={s.scanLibrary}
          >
            <h2 id="choose-part-heading">No label nearby?</h2>
            <p>
              Choose a demo part below, or find every part in the{" "}
              <Link href="/dashboard" className="underline underline-offset-4">
                dashboard
              </Link>
              .
            </p>
            <ul className="mt-4 border-t border-line">
              {PARTS.map(([id, name]) => (
                <li key={id} className="border-b border-line">
                  <Link
                    href={`/components/${id}`}
                    className="flex min-h-14 items-center justify-between gap-3 py-3 font-medium hover:text-muted"
                  >
                    <span>{name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
