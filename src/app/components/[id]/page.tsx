import Link from "next/link";
import ComponentCardLoader from "@/components/component-card-loader";

export const metadata = { title: "Part history | Machine Memory" };

export default async function ComponentPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const role = query.role === "technician" ? "technician" : "operator";
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <Link href="/scan" className="flex min-h-11 w-fit items-center rounded underline underline-offset-4 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4">
        ← Scan another part
      </Link>
      <ComponentCardLoader key={`${id}:${role}`} id={id} role={role} />
    </main>
  );
}
