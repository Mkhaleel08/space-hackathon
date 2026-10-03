import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { getAsset, getComponent, listEvents } from "@/lib/server/data";

export const dynamic = "force-dynamic";


/** The newest thing any machine remembers, for the first screen. Null when the memory is empty or unreachable. */
async function latestMemory() {
  try {
    const [event] = await listEvents(1);
    if (!event) return null;
    const component = await getComponent(event.component_id);
    const asset = component ? await getAsset(component.asset_id) : null;
    return { event, component, asset };
  } catch {
    return null;
  }
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export default async function Home() {
  const memory = await latestMemory();
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-16 pt-[14svh] sm:pt-[20svh]">
      <h1 className="font-display text-[2.75rem] font-semibold leading-none tracking-tight sm:text-[3.25rem]">Machine Memory</h1>
      <p className="mt-4 max-w-sm text-balance text-lg leading-snug text-muted">
        Point your camera at a part. See what the machine remembers.
      </p>

      {memory && (
        <figure className="mt-12 border-t border-line pt-5">
          <blockquote className="font-display text-[1.375rem] font-medium leading-snug">“{memory.event.summary}”</blockquote>
          <figcaption className="mt-2 text-sm text-muted">
            {memory.component?.name ?? memory.event.component_id}
            {memory.asset ? `, ${memory.asset.name}` : ""}
            {`, ${ago(memory.event.created_at)}`}
          </figcaption>
        </figure>
      )}

      <nav aria-label="Start" className="mt-12 flex flex-col gap-3">
        <Link href="/ar" className={`${btnPrimary} min-h-14 text-lg`}>
          Live view
        </Link>
        <Link href="/scan" className={`${btnSecondary} min-h-14 text-lg`}>
          Scan a part
        </Link>
      </nav>

      <div className="mt-14 border-t border-line pt-5">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center font-medium underline decoration-line underline-offset-4 transition-colors duration-150 hover:decoration-foreground">
          Operator dashboard
        </Link>
        <p className="mt-0.5 text-sm text-muted">Every machine, every part, the recent notes.</p>
      </div>
    </main>
  );
}
