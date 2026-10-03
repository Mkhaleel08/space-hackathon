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
    </main>
  );
}
