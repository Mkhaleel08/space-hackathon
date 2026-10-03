import Link from "next/link";
import TagImage from "@/components/dashboard/tag-image";
import { listAssets, listComponents } from "@/lib/server/data";
import { tagsOrFallback } from "@/lib/server/tags";
import PrintButton from "./print-button";
import { ArrowLeft } from "@/components/icons";
import { h1, meta } from "@/components/ui";

export const metadata = { title: "AprilTag labels | Machine Memory" };
export const dynamic = "force-dynamic";

/** Print-ready labels for every tagged part, or one part with ?component=id. */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ component?: string }> }) {
  const { component: only } = await searchParams;
  const [assets, components, { tags }] = await Promise.all([listAssets(), listComponents(), tagsOrFallback()]);
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const componentsById = new Map(components.map((c) => [c.id, c]));
  const labels = tags
    .filter((t) => (!only || t.component_id === only) && componentsById.has(t.component_id))
    .map((t) => ({ tag: t, component: componentsById.get(t.component_id)! }))
    .sort((a, b) => a.tag.tag_id - b.tag.tag_id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-6 sm:py-10 print:max-w-none print:gap-0 print:p-0">
      <div className="flex flex-col gap-8 print:hidden">
        <Link href="/dashboard" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted hover:text-foreground"><ArrowLeft /> Operator dashboard</Link>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className={h1}>AprilTag labels</h1>
            <p className={`${meta} mt-1.5 max-w-[60ch] text-base`}>
              {labels.length} {labels.length === 1 ? "label" : "labels"}. Print at 100% on matte paper; each tag is 60 mm. Cut on the dashed lines and keep the white border, it is part of the marker.
            </p>
          </div>
          {labels.length > 0 && <PrintButton />}
        </div>
      </div>
      {labels.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-muted">
          {only ? "That part has no tag yet. Assign one from the dashboard." : "No tags assigned yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 print:grid-cols-2 print:gap-4 print:p-4">
          {labels.map(({ tag, component }) => (
            <li key={tag.tag_id} className="break-inside-avoid border border-dashed border-neutral-400 bg-white p-4 text-center text-neutral-900">
              <div className="mx-auto h-[60mm] w-[60mm]">
                <TagImage id={tag.tag_id} className="block h-full w-full" title={`AprilTag ${tag.tag_id} for ${component.name}`} />
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-tight">{component.name}</h2>
              <p className="mt-0.5 text-sm text-neutral-600">{component.location}</p>
              <p className="mt-1.5 font-mono text-[11px] text-neutral-500">tag {tag.tag_id} · {component.id} · {assetsById.get(component.asset_id)?.name ?? component.asset_id}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
