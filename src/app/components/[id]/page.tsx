import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import RoleCard from "@/components/role-card";

export const metadata = { title: "Part history | Machine Memory" };

export default async function ComponentPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-6 sm:py-10">
      <Link href="/scan" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft /> Scan another part
      </Link>
      <RoleCard id={id} />
    </main>
  );
}
